/** Transport-independent Host dispatcher for API and generic RPC channels. */

import { Context, Service } from '@deepseek-ai/cordis'
import {
  clientRequestSchema,
  RpcId,
  type ClientRequest,
  type RpcError,
  type RpcErrorDetailsMap,
  type RpcId as RpcIdType,
  type ServerResponse as RpcServerResponse,
} from '@deepseek-ai/dsh-host-apiproxy/api'
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import { API_PATH } from './api-path.ts'
import type {
  ConnectionRequestAuthority,
  ConnectionRpcAuthority,
  ConnectionRpcEndpointMatcher,
  ConnectionRpcHandler,
  ConnectionRpcHandlerOptions,
  HostConnectionHandle,
  HostConnectionRpc,
} from './rpc.ts'

const INVALID_REQUEST_RPC_ID = RpcId('invalid-request')
const CHANNEL_PATTERN = /^\/[A-Za-z0-9._~-]+$/
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/

interface ConnectionRpcInterceptor {
  readonly matches: ConnectionRpcEndpointMatcher
  readonly fetchHandler: FetchHandler
  readonly options: ConnectionRpcHandlerOptions
}

interface FetchHandler {
  fetch(request: Request): Promise<Response>
}

interface ConnectionRpcChannel {
  readonly fetchHandler: FetchHandler
  readonly options: ConnectionRpcHandlerOptions
}

type ChannelMount = (channel: string) => () => void

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Connection transport and RPC registrations. */
    connection: HostConnectionHandle
  }
}

/** Host Connection service whose channel registrations belong to the caller fiber. */
export class HostConnectionService extends Service implements HostConnectionHandle {
  private readonly interceptors = new Map<string, ConnectionRpcInterceptor>()
  private readonly channels = new Map<string, ConnectionRpcChannel>()
  private readonly observers = new Map<ChannelMount, Map<string, () => void>>()

  /**
   * Provide the Host half independently of its HTTP or desktop carrier.
   * @param ctx - owning Connection plugin context.
   */
  constructor(ctx: Context) {
    super(ctx, 'connection')
  }

  /** Generic channel registry scoped to the Context reading this service. */
  get rpc(): HostConnectionRpc {
    const owner = this.ctx
    return {
      handle: (channel, handler, options) => this.register(owner, channel, handler, options),
      intercept: (channel, matches, handler, options) =>
        this.registerInterceptor(owner, channel, matches, handler, options),
    }
  }

  /** @inheritdoc */
  dispatch(request: Request, authority: ConnectionRequestAuthority): Promise<Response> {
    const pathname = new URL(request.url).pathname
    if (pathname === API_PATH || pathname.startsWith(`${API_PATH}/`)) {
      return this.dispatchApi(request, authority)
    }
    for (const [channel, record] of this.channels) {
      if (pathname !== channel && !pathname.startsWith(`${channel}/`)) continue
      if (!acceptsAuthority(record.options.authority, authority)) {
        return Promise.resolve(new Response('forbidden', { status: 403 }))
      }
      return record.fetchHandler.fetch(request)
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  }

  /** @inheritdoc */
  observeRpcChannels(mount: ChannelMount): () => void {
    const mounted = new Map<string, () => void>()
    try {
      for (const channel of this.channels.keys()) mounted.set(channel, mount(channel))
    } catch (error) {
      for (const dispose of mounted.values()) dispose()
      throw error
    }
    this.observers.set(mount, mounted)
    return () => {
      this.observers.delete(mount)
      for (const dispose of mounted.values()) dispose()
    }
  }

  /** Dispatch the shared API channel through an interceptor or API Proxy fallback. */
  private dispatchApi(request: Request, authority: ConnectionRequestAuthority): Promise<Response> {
    const endpoint = endpointFromPath(API_PATH, new URL(request.url).pathname)
    const interceptor = this.interceptors.get(API_PATH)
    if (endpoint !== undefined && interceptor !== undefined && interceptor.matches(endpoint)) {
      if (!acceptsAuthority(interceptor.options.authority, authority)) {
        return Promise.resolve(new Response('forbidden', { status: 403 }))
      }
      return interceptor.fetchHandler.fetch(request)
    }
    if (endpoint !== undefined && PRIVILEGED_METHODS.has(endpoint) && authority !== 'loopback') {
      return Promise.resolve(new Response('forbidden', { status: 403 }))
    }
    const apiProxy = this.ctx.get('apiProxy')
    if (apiProxy === undefined) return Promise.resolve(new Response('not found', { status: 404 }))
    return toFetchHandler(apiProxy).fetch(request)
  }

  private register(
    owner: Context,
    channel: string,
    handler: ConnectionRpcHandler,
    options: ConnectionRpcHandlerOptions,
  ): () => Promise<void> {
    assertChannel(channel)
    return owner.effect(
      () => this.addChannel(channel, { fetchHandler: rpcFetchHandler(channel, handler), options }),
      `client-connection: ${channel} rpc channel`,
    )
  }

  private addChannel(channel: string, record: ConnectionRpcChannel): () => void {
    if (this.channels.has(channel)) {
      throw new Error(`connection: dedicated RPC channel ${JSON.stringify(channel)} already has a handler`)
    }
    this.channels.set(channel, record)
    const mounted: Array<Map<string, () => void>> = []
    try {
      for (const [mount, routes] of this.observers) {
        routes.set(channel, mount(channel))
        mounted.push(routes)
      }
    } catch (error) {
      for (const routes of mounted) {
        routes.get(channel)?.()
        routes.delete(channel)
      }
      this.channels.delete(channel)
      throw error
    }
    return () => {
      this.channels.delete(channel)
      for (const routes of this.observers.values()) {
        routes.get(channel)?.()
        routes.delete(channel)
      }
    }
  }

  private registerInterceptor(
    owner: Context,
    channel: string,
    matches: ConnectionRpcEndpointMatcher,
    handler: ConnectionRpcHandler,
    options: ConnectionRpcHandlerOptions,
  ): () => Promise<void> {
    if (channel !== API_PATH) {
      throw new Error(`connection: invalid shared RPC channel ${JSON.stringify(channel)}`)
    }
    const interceptor: ConnectionRpcInterceptor = {
      matches,
      fetchHandler: rpcFetchHandler(channel, handler),
      options,
    }
    return owner.effect(() => {
      if (this.interceptors.has(channel)) {
        throw new Error(`connection: shared RPC channel ${JSON.stringify(channel)} already has an interceptor`)
      }
      this.interceptors.set(channel, interceptor)
      return () => {
        this.interceptors.delete(channel)
      }
    }, `client-connection: ${channel} rpc interceptor`)
  }
}

const PRIVILEGED_METHODS = new Set([
  'agentPreset.read',
  'agentPreset.copy',
  'agentPreset.openDocument',
  'agentPreset.remove',
  'host.pickDirectory',
  'host.openPath',
  'settings.describe',
  'settings.openDocument',
  'settings.update',
  'settings.replace',
  'settings.mutate',
  'credentials.describe',
  'credentials.set',
  'credentials.unset',
  'llm.discoverModels',
])

function acceptsAuthority(required: ConnectionRpcAuthority, actual: ConnectionRequestAuthority): boolean {
  return required === 'trusted-host' || actual === 'loopback'
}

function rpcFetchHandler(
  channel: string,
  handler: ConnectionRpcHandler,
): FetchHandler {
  return {
    async fetch(request: Request): Promise<Response> {
      const endpoint = endpointFromPath(channel, new URL(request.url).pathname)
      if (request.method !== 'POST' || endpoint === undefined) {
        return new Response('not found', { status: 404 })
      }

      const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      if (mediaType !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 })
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }

      const envelope = clientRequestSchema.safeParse(body)
      if (!envelope.success) {
        return invalidEnvelopeResponse(body, envelope.error.issues)
      }
      const message: ClientRequest = envelope.data
      if (message.method !== endpoint) {
        return errorResponse(message.rpcId, {
          code: 'bad-request',
          message: `method ${JSON.stringify(message.method)} does not match endpoint ${JSON.stringify(endpoint)}`,
          details: { issues: [] },
        })
      }

      try {
        const result = await handler(endpoint, message.payload, request.signal)
        return fullResponse(message.rpcId, result)
      } catch (error) {
        return new Response(`handler failure: ${String(error)}`, { status: 500 })
      }
    },
  }
}

function invalidEnvelopeResponse(body: unknown, issues: RpcErrorDetailsMap['bad-request']['issues']): Response {
  const rawId = (body as { rpcId?: unknown } | null)?.rpcId
  const rpcId = typeof rawId === 'string' ? RpcId(rawId) : INVALID_REQUEST_RPC_ID
  return errorResponse(rpcId, {
    code: 'bad-request',
    message: 'invalid client-request message',
    details: { issues },
  })
}

function endpointFromPath(channel: string, pathname: string): string | undefined {
  if (!pathname.startsWith(`${channel}/`)) return undefined
  const endpoint = pathname.slice(channel.length + 1)
  const segments = endpoint.split('/')
  if (segments.some(segment =>
    segment === '' || segment === '.' || segment === '..' || !ENDPOINT_SEGMENT_PATTERN.test(segment))) {
    return undefined
  }
  return endpoint
}

function errorResponse(rpcId: RpcIdType, error: RpcError): Response {
  return fullResponse(rpcId, { ok: false, error })
}

function fullResponse(rpcId: RpcIdType, result: RpcServerResponse['result']): Response {
  const body: RpcServerResponse = { type: 'server-response', rpcId, result }
  return Response.json(body)
}

function assertChannel(channel: string): void {
  if (!CHANNEL_PATTERN.test(channel) || channel === '/api') {
    throw new Error(`connection: invalid or reserved RPC channel ${JSON.stringify(channel)}`)
  }
}
