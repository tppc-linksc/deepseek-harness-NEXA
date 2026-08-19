import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { PortlessWebServer } from '../src/portless-webserver.ts'

describe('portless desktop WebServer carrier', () => {
  it('dispatches exact and longest-prefix routes without a listening port', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'prefix',
      path: '/dsh-market',
      handler: (_request, response) => { response.end('market') },
    })
    server.register({
      kind: 'prefix',
      path: '/dsh-market/themes',
      handler: (_request, response) => { response.end('themes') },
    })
    server.register({
      kind: 'exact',
      path: '/dsh-market/themes/current',
      handler: (_request, response) => { response.end('current') },
    })

    expect(server.port).toBe(0)
    await expect(server.fetch(new Request('dsh://app/dsh-market/plugins')).then(response => response.text()))
      .resolves.toBe('market')
    await expect(server.fetch(new Request('dsh://app/dsh-market/themes/catalog')).then(response => response.text()))
      .resolves.toBe('themes')
    await expect(server.fetch(new Request('dsh://app/dsh-market/themes/current')).then(response => response.text()))
      .resolves.toBe('current')
  })

  it('carries request bodies and supplies a same-origin loopback HTTP header pair', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/dsh-market/install',
      handler: async (request, response) => {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array))
        response.writeHead(201, { 'content-type': 'application/json', 'x-origin': request.headers.origin ?? '' })
        response.end(JSON.stringify({ host: request.headers.host, body: Buffer.concat(chunks).toString('utf8') }))
      },
    })

    const response = await server.fetch(new Request('dsh://app/dsh-market/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"package":"dsh-plugin-example"}',
    }))
    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('x-origin')).toBe('http://127.0.0.1')
    await expect(response.json()).resolves.toEqual({
      host: '127.0.0.1',
      body: '{"package":"dsh-plugin-example"}',
    })
  })

  it('carries extension methods and request bodies without Web-only behavior', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/extension/resource',
      handler: async (request, response) => {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array))
        response.end(`${request.method}:${Buffer.concat(chunks).toString('utf8')}`)
      },
    })

    for (const method of ['DELETE', 'OPTIONS', 'PATCH', 'PUT']) {
      const response = await server.fetch(new Request('dsh://app/extension/resource', {
        method,
        ...(method === 'OPTIONS' ? {} : { body: method.toLowerCase() }),
      }))
      await expect(response.text()).resolves.toBe(
        method === 'OPTIONS' ? 'OPTIONS:' : `${method}:${method.toLowerCase()}`,
      )
    }
  })

  it('maps the validated desktop Origin to loopback HTTP for extension route guards', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/api/usage-stats/usage',
      handler: (request, response) => {
        const accepted = request.socket.remoteAddress === '127.0.0.1'
          && request.headers.host === '127.0.0.1'
          && request.headers.origin === 'http://127.0.0.1'
        response.writeHead(accepted ? 200 : 403)
        response.end()
      },
    })

    const response = await server.fetch(new Request('dsh://app/api/usage-stats/usage', {
      headers: { origin: 'dsh://app' },
    }))
    expect(response.status).toBe(200)
  })

  it('preserves an explicit foreign Origin for route-owned CSRF rejection', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/dsh-market/install',
      handler: (request, response) => {
        response.end(`${request.headers.origin}|${request.headers.host}`)
      },
    })

    const response = await server.fetch(new Request('dsh://app/dsh-market/install', {
      headers: { origin: 'https://foreign.example' },
    }))
    await expect(response.text()).resolves.toBe('https://foreign.example|127.0.0.1')
  })

  it('routes extension-owned API paths before the logical connection fallback', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/api/tokenledger/usage',
      handler: (_request, response) => {
        response.setHeader('content-type', 'application/json')
        response.end('{"ok":true}')
      },
    })
    const connectionFallback = vi.fn(async () => new Response('rpc', { status: 202 }))

    const extensionResponse = await server.fetch(
      new Request('dsh://app/api/tokenledger/usage'),
      connectionFallback,
    )
    expect(extensionResponse.status).toBe(200)
    await expect(extensionResponse.json()).resolves.toEqual({ ok: true })
    expect(connectionFallback).not.toHaveBeenCalled()

    const rpcResponse = await server.fetch(
      new Request('dsh://app/api/session.list'),
      connectionFallback,
    )
    expect(rpcResponse.status).toBe(202)
    await expect(rpcResponse.text()).resolves.toBe('rpc')
    expect(connectionFallback).toHaveBeenCalledOnce()
  })

  it('rejects duplicate ownership and returns 404 for an unmatched route', async () => {
    const server = new PortlessWebServer(new Context())
    const route: WebRoute = {
      kind: 'exact' as const,
      path: '/dsh-market/status',
      handler: () => undefined,
    }
    server.register(route)
    expect(() => server.register(route)).toThrow('duplicate exact route')
    const response = await server.fetch(new Request('dsh://app/dsh-market/missing'))
    expect(response.status).toBe(404)
  })

  it('streams an open response and reports cancellation through ServerResponse close', async () => {
    const server = new PortlessWebServer(new Context())
    let writeMore!: () => void
    const closed = vi.fn()
    server.register({
      kind: 'exact',
      path: '/extension/events',
      handler: (_request, response) => {
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        })
        response.on('close', closed)
        response.write('data: first\n\n')
        writeMore = () => { response.write('data: second\n\n') }
      },
    })

    const response = await server.fetch(new Request('dsh://app/extension/events'))
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    const reader = response.body?.getReader()
    if (reader === undefined) throw new Error('streaming response body missing')
    await expect(reader.read()).resolves.toMatchObject({ done: false })
    writeMore()
    await expect(reader.read()).resolves.toMatchObject({ done: false })
    await reader.cancel()
    expect(closed).toHaveBeenCalledOnce()
  })

  it('supports common ServerResponse header and completion methods', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/extension/headers',
      handler: (_request, response) => {
        response.statusCode = 202
        response.setHeader('x-remove', 'unused')
        expect(response.hasHeader('x-remove')).toBe(true)
        response.removeHeader('x-remove')
        response.setHeader('x-extension', ['one', 'two'])
        expect(response.getHeader('x-extension')).toEqual('one, two')
        response.end('accepted')
        expect(response.writableEnded).toBe(true)
      },
    })

    const response = await server.fetch(new Request('dsh://app/extension/headers'))
    expect(response.status).toBe(202)
    expect(response.headers.get('x-extension')).toBe('one, two')
    await expect(response.text()).resolves.toBe('accepted')
  })

  it('rejects a route that returns without ending its response', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/unfinished',
      handler: () => undefined,
    })

    await expect(server.fetch(new Request('dsh://app/unfinished'))).rejects.toThrow(
      'route "/unfinished" returned without starting its response',
    )
  })

  it('rejects response metadata that Fetch cannot represent', async () => {
    const server = new PortlessWebServer(new Context())
    server.register({
      kind: 'exact',
      path: '/unsupported-status',
      handler: (_request, response) => {
        response.statusCode = 101
        response.end()
      },
    })

    await expect(server.fetch(new Request('dsh://app/unsupported-status'))).rejects.toThrow()
  })
})
