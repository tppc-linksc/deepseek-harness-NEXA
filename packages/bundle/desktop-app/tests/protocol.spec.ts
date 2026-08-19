import { describe, expect, it } from 'vitest'
import { desktopSurfacePrompt } from '../src/index.ts'
import {
  DESKTOP_ORIGIN,
  DESKTOP_REQUEST_METHODS,
  parseDesktopHostMessage,
  parseDesktopMainMessage,
} from '../src/protocol.ts'

describe('desktop utility-process protocol', () => {
  it('describes the portless desktop surface to the model', () => {
    expect(desktopSurfacePrompt()).toContain('DeepSeek Harness desktop application')
    expect(desktopSurfacePrompt()).toContain('does not expose an HTTP listening port')
  })

  it('validates and rebuilds renderer requests', () => {
    const body = new Uint8Array([1, 2, 3])
    const message = parseDesktopMainMessage({
      type: 'request',
      id: 'request-1',
      url: `${DESKTOP_ORIGIN}/api/host.describe`,
      method: 'post',
      headers: [['content-type', 'application/json']],
      body,
    })
    expect(message).toEqual({
      type: 'request',
      id: 'request-1',
      url: `${DESKTOP_ORIGIN}/api/host.describe`,
      method: 'POST',
      headers: [['content-type', 'application/json']],
      body,
    })
    if (message.type !== 'request' || message.body === undefined) throw new Error('request body missing')
    expect(message.body).not.toBe(body)
  })

  it('carries ordinary Fetch methods used by extension-owned HTTP routes', () => {
    for (const method of DESKTOP_REQUEST_METHODS) {
      expect(parseDesktopMainMessage({
        type: 'request',
        id: `request-${method}`,
        url: `${DESKTOP_ORIGIN}/api/test`,
        method: method.toLowerCase(),
        headers: [],
      })).toMatchObject({ method })
    }
  })

  it('rejects another origin, forbidden methods, malformed ids, and non-byte bodies', () => {
    const request = {
      type: 'request',
      id: 'request-1',
      url: `${DESKTOP_ORIGIN}/api/test`,
      method: 'POST',
      headers: [],
    }
    expect(() => parseDesktopMainMessage({ ...request, url: 'https://example.com/api/test' }))
      .toThrow('rejected request authority')
    expect(() => parseDesktopMainMessage({ ...request, method: 'CONNECT' }))
      .toThrow('rejected request method')
    expect(() => parseDesktopMainMessage({ ...request, method: 'TRACE' }))
      .toThrow('rejected request method')
    expect(() => parseDesktopMainMessage({ ...request, id: '' })).toThrow('1 to 128')
    expect(() => parseDesktopMainMessage({ ...request, body: [1, 2, 3] })).toThrow('must be bytes')
  })

  it('validates and rebuilds response heads, chunks, completion, and boot graphs', () => {
    expect(parseDesktopHostMessage({
      type: 'ready',
      graph: {
        rev: 'graph-1',
        entries: [{ id: 'module', url: '/plugins/module/client.js', rev: 'module-1', immediately: true }],
      },
    })).toEqual({
      type: 'ready',
      graph: {
        rev: 'graph-1',
        entries: [{ id: 'module', url: '/plugins/module/client.js', rev: 'module-1', immediately: true }],
      },
    })
    expect(parseDesktopHostMessage({
      type: 'response', id: 'request-1', status: 200, headers: [['content-type', 'text/plain']],
    })).toEqual({
      type: 'response', id: 'request-1', status: 200, headers: [['content-type', 'text/plain']],
    })
    expect(parseDesktopHostMessage({ type: 'chunk', id: 'request-1', chunk: new Uint8Array([4]) }))
      .toEqual({ type: 'chunk', id: 'request-1', chunk: new Uint8Array([4]) })
    expect(parseDesktopHostMessage({ type: 'end', id: 'request-1' }))
      .toEqual({ type: 'end', id: 'request-1' })
  })

  it('rejects malformed response status and boot graph fields', () => {
    expect(() => parseDesktopHostMessage({
      type: 'response', id: 'request-1', status: 999, headers: [],
    })).toThrow('HTTP status integer')
    expect(() => parseDesktopHostMessage({
      type: 'ready', graph: { rev: 'graph-1', entries: [{ id: 'module', url: 42, rev: 'module-1' }] },
    })).toThrow('url must be a string')
    expect(() => parseDesktopHostMessage({ type: 'unknown', id: 'request-1' }))
      .toThrow('unknown host message type')
  })
})
