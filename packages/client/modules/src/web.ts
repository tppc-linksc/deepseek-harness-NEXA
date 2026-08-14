/** Browser HTTP adapter for client bundle assets and boot-manifest injection. */

import type { Context } from '@deepseek-ai/cordis'
import { bridgeFetch } from '@deepseek-ai/dsh-host-webserver'
import { injectBootManifest } from './index.ts'

/** Stable Cordis plugin name. */
export const name = 'client-modules-web'

/** Services required by the browser asset adapter. */
export const inject = ['clientModules', 'webServer']

/**
 * Mount the browser-only `/plugins` route and index transform.
 * @param ctx - Host context carrying the transport-independent registry and HTTP server.
 */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: '/plugins',
      handler: (request, response) => bridgeFetch(request, response, ctx.clientModules),
    }),
    'client-modules-web: bundle route',
  )
  ctx.effect(
    () => ctx.webServer.tapIndex(html => injectBootManifest(html, ctx.clientModules.graph())),
    'client-modules-web: boot manifest injection',
  )
}
