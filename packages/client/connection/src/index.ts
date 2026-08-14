/** Transport-independent Host Connection service and shared wire contracts. */

import type { Context } from '@deepseek-ai/cordis'
import { HostConnectionService } from './rpc-host.ts'

export type {
  ConnectionRequestAuthority,
  ConnectionRpcAuthority,
  ConnectionRpcEndpointMatcher,
  ConnectionRpcHandler,
  ConnectionRpcHandlerOptions,
  HostConnectionHandle,
  HostConnectionRpc,
} from './rpc.ts'
export { HostConnectionService } from './rpc-host.ts'
export { API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH } from './api-path.ts'

/** Stable Cordis plugin name. */
export const name = 'client-connection'

/** The logical Connection registry has no physical transport dependency. */
export const inject: string[] = []

/**
 * Provide the transport-independent Host dispatcher.
 * @param ctx - Host plugin context.
 */
export function apply(ctx: Context): void {
  new HostConnectionService(ctx)
}
