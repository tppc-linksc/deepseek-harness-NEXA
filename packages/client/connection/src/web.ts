/** HTTP/WebSocket adapter for the Host Connection service. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import {
  bridgeFetch,
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  type FetchHandler,
  type WebRoute,
  type WebUpgradeRoute,
} from '@deepseek-ai/dsh-host-webserver'
import { API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH } from './api-path.ts'
import { assertTrustedAuthority, isTrustedApiRequest } from './api-request-trust.ts'
import type { ConnectionRequestAuthority } from './rpc.ts'
import { rejectWebSocketUpgrade, WebSocketDownlinks } from './websocket-downlink.ts'

/** Stable Cordis plugin name. */
export const name = 'client-connection-web'

/** Services required by the browser carrier. */
export const inject = ['connection', 'webServer']

/** Headroom for RPC JSON fields around aggregate base64 image payloads. */
const REQUEST_ENVELOPE_HEADROOM_BYTES = 1024 * 1024

/** Browser carrier configuration. */
export interface Config {
  /** Non-loopback serving authorities accepted by the browser trust fence. */
  trustedHosts?: string[]
  /** Maximum buffered JSON body for each browser request. */
  maxRequestBodyBytes?: number
}

/** Browser carrier configuration schema. */
export const Config: z<Config> = z.object({
  trustedHosts: z.array(String).default([]),
  maxRequestBodyBytes: z.natural().min(1).default(DEFAULT_MAX_REQUEST_BODY_BYTES),
})

function assertImageBodyCapacity(attachments: AttachmentStore | undefined, maxRequestBodyBytes: number): void {
  if (attachments === undefined) return
  const requiredImageBodyBytes = Math.ceil(
    attachments.imageLimits.maxMessageImageBytes * 4 / 3,
  ) + REQUEST_ENVELOPE_HEADROOM_BYTES
  if (maxRequestBodyBytes < requiredImageBodyBytes) {
    throw new Error(
      `client-connection-web maxRequestBodyBytes (${String(maxRequestBodyBytes)}) must be at least `
      + `${String(requiredImageBodyBytes)} for the configured aggregate image limit`,
    )
  }
}

/**
 * Mount HTTP routes and WebSocket downlinks over the logical Connection service.
 * @param ctx - Host plugin context.
 * @param config - resolved browser carrier configuration.
 */
export function apply(ctx: Context, config?: Config): void {
  const trustedHosts = config?.trustedHosts ?? []
  const maxRequestBodyBytes = config?.maxRequestBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES
  for (const entry of trustedHosts) assertTrustedAuthority(entry)
  assertImageBodyCapacity(ctx.get('attachments'), maxRequestBodyBytes)

  const mountRoute = (path: string): (() => void) => ctx.webServer.register({
    kind: 'prefix',
    path,
    handler: async (req, res) => {
      if (!isTrustedApiRequest(req, trustedHosts)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      const authority: ConnectionRequestAuthority = isTrustedApiRequest(req, [])
        ? 'loopback'
        : 'trusted-host'
      const handler: FetchHandler = {
        fetch: (request) => {
          const pathname = new URL(request.url).pathname
          if (request.method === 'GET' && (pathname === MUX_EVENTS_PATH || pathname === HOST_EVENTS_PATH)) {
            return Promise.resolve(new Response('upgrade required', {
              status: 426,
              headers: { connection: 'Upgrade', upgrade: 'websocket' },
            }))
          }
          return ctx.connection.dispatch(request, authority)
        },
      }
      await bridgeFetch(req, res, handler, maxRequestBodyBytes)
    },
  } satisfies WebRoute)

  ctx.effect(() => mountRoute(API_PATH), 'client-connection-web: /api route')
  ctx.effect(
    () => ctx.connection.observeRpcChannels(mountRoute),
    'client-connection-web: dedicated RPC routes',
  )

  ctx.inject(['apiProxy'], (apiCtx) => {
    assertImageBodyCapacity(apiCtx.get('attachments'), maxRequestBodyBytes)
    const downlinks = new WebSocketDownlinks(apiCtx.apiProxy)
    const registerDownlink = (path: string, handle: WebUpgradeRoute['handler']): void => {
      apiCtx.effect(() => apiCtx.webServer.registerUpgrade({
        path,
        handler: (req, socket, head) => {
          if (!isTrustedApiRequest(req, trustedHosts)) {
            rejectWebSocketUpgrade(socket)
            return
          }
          return handle(req, socket, head)
        },
      }), `client-connection-web: ${path} WebSocket`)
    }
    apiCtx.effect(() => () => downlinks.close(), 'client-connection-web: WebSocket downlinks')
    registerDownlink(MUX_EVENTS_PATH, (req, socket, head) => { downlinks.handleMux(req, socket, head) })
    registerDownlink(HOST_EVENTS_PATH, (req, socket, head) => { downlinks.handleHost(req, socket, head) })
  })
}
