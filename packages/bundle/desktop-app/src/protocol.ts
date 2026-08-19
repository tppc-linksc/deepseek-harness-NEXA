/** Validated messages exchanged by the Electron main and Harness utility processes. */

import type { WebBootGraph } from '@deepseek-ai/dsh-client-modules'

/** Custom protocol used by the desktop renderer. */
export const DESKTOP_SCHEME = 'dsh'
/** Standard custom-protocol origin hosting the desktop renderer. */
export const DESKTOP_ORIGIN = `${DESKTOP_SCHEME}://app`
/** Maximum request body copied across the utility-process channel. */
export const DESKTOP_MAX_REQUEST_BODY_BYTES = 160 * 1024 * 1024
/** Fetch methods carried from the private renderer origin to registered routes. */
export const DESKTOP_REQUEST_METHODS = [
  'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT',
] as const

/**
 * Test whether a URL belongs to the desktop renderer authority.
 * @param value - absolute URL string or parsed URL.
 * @returns whether the protocol, host, credentials, and port are the desktop authority.
 */
export function isDesktopUrl(value: string | URL): boolean {
  const url = typeof value === 'string' ? new URL(value) : value
  return url.protocol === `${DESKTOP_SCHEME}:`
    && url.hostname === 'app'
    && url.port === ''
    && url.username === ''
    && url.password === ''
}

/** Request sent from Electron main to the Harness utility process. */
export interface DesktopRequestMessage {
  readonly type: 'request'
  readonly id: string
  readonly url: string
  readonly method: string
  readonly headers: [string, string][]
  readonly body?: Uint8Array
}

/** Backpressure signal for one response-body chunk. */
export interface DesktopPullMessage {
  readonly type: 'pull'
  readonly id: string
}

/** Cancellation signal for a renderer request. */
export interface DesktopCancelMessage {
  readonly type: 'cancel'
  readonly id: string
}

/** Main-to-utility message union. */
export type DesktopMainMessage = DesktopRequestMessage | DesktopPullMessage | DesktopCancelMessage

/** Utility readiness message carrying the current client-plugin graph. */
export interface DesktopReadyMessage {
  readonly type: 'ready'
  readonly graph: WebBootGraph
}

/** Response head sent before the pull-driven body. */
export interface DesktopResponseMessage {
  readonly type: 'response'
  readonly id: string
  readonly status: number
  readonly headers: [string, string][]
}

/** One response body chunk. */
export interface DesktopChunkMessage {
  readonly type: 'chunk'
  readonly id: string
  readonly chunk: Uint8Array
}

/** Normal response completion. */
export interface DesktopEndMessage {
  readonly type: 'end'
  readonly id: string
}

/** Request-scoped or boot-fatal diagnostic. */
export interface DesktopErrorMessage {
  readonly type: 'error'
  readonly id?: string
  readonly message: string
}

/** Utility-to-main message union. */
export type DesktopHostMessage = DesktopReadyMessage | DesktopResponseMessage
  | DesktopChunkMessage | DesktopEndMessage | DesktopErrorMessage

/**
 * Validate and rebuild one main-to-utility message.
 * @param value - structured-clone payload from Electron main.
 * @returns the narrowed message.
 */
export function parseDesktopMainMessage(value: unknown): DesktopMainMessage {
  const record = objectRecord(value, 'desktop main message')
  const type = stringField(record, 'type')
  const id = idField(record)
  if (type === 'pull' || type === 'cancel') return { type, id }
  if (type !== 'request') throw new Error(`desktop bridge: unknown main message type ${JSON.stringify(type)}`)
  const url = stringField(record, 'url')
  const parsed = new URL(url)
  if (!isDesktopUrl(parsed)) throw new Error(`desktop bridge: rejected request authority ${JSON.stringify(parsed.host)}`)
  const method = stringField(record, 'method').toUpperCase()
  if (!(DESKTOP_REQUEST_METHODS as readonly string[]).includes(method)) {
    throw new Error(`desktop bridge: rejected request method ${JSON.stringify(method)}`)
  }
  const headers = headerPairs(record.headers)
  const body = record.body === undefined ? undefined : bytes(record.body, 'request body')
  if (body !== undefined && body.byteLength > DESKTOP_MAX_REQUEST_BODY_BYTES) {
    throw new Error('desktop bridge: request body exceeds the desktop carrier limit')
  }
  return { type, id, url, method, headers, ...(body === undefined ? {} : { body }) }
}

/**
 * Validate and rebuild one utility-to-main message.
 * @param value - structured-clone payload from the Harness utility process.
 * @returns the narrowed message.
 */
export function parseDesktopHostMessage(value: unknown): DesktopHostMessage {
  const record = objectRecord(value, 'desktop host message')
  const type = stringField(record, 'type')
  if (type === 'ready') return { type, graph: bootGraph(record.graph) }
  if (type === 'error') {
    const id = record.id === undefined ? undefined : stringField(record, 'id')
    return { type, ...(id === undefined ? {} : { id }), message: stringField(record, 'message') }
  }
  const id = idField(record)
  if (type === 'end') return { type, id }
  if (type === 'chunk') return { type, id, chunk: bytes(record.chunk, 'response chunk') }
  if (type === 'response') {
    const status = record.status
    if (!Number.isInteger(status) || (status as number) < 100 || (status as number) > 599) {
      throw new Error('desktop bridge: response status must be an HTTP status integer')
    }
    return { type, id, status: status as number, headers: headerPairs(record.headers) }
  }
  throw new Error(`desktop bridge: unknown host message type ${JSON.stringify(type)}`)
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`desktop bridge: ${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field]
  if (typeof value !== 'string') throw new Error(`desktop bridge: ${field} must be a string`)
  return value
}

function idField(record: Record<string, unknown>): string {
  const id = stringField(record, 'id')
  if (id === '' || id.length > 128) throw new Error('desktop bridge: id must contain 1 to 128 characters')
  return id
}

function headerPairs(value: unknown): [string, string][] {
  if (!Array.isArray(value)) throw new Error('desktop bridge: headers must be an array')
  return value.map((pair): [string, string] => {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(item => typeof item !== 'string')) {
      throw new Error('desktop bridge: each header must be a string pair')
    }
    return [pair[0] as string, pair[1] as string]
  })
}

function bytes(value: unknown, label: string): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new Error(`desktop bridge: ${label} must be bytes`)
  return new Uint8Array(value)
}

function bootGraph(value: unknown): WebBootGraph {
  const graph = objectRecord(value, 'boot graph')
  const rev = stringField(graph, 'rev')
  if (!Array.isArray(graph.entries)) throw new Error('desktop bridge: boot graph entries must be an array')
  return {
    rev,
    entries: graph.entries.map((entry) => {
      const row = objectRecord(entry, 'boot graph entry')
      const inject = row.inject
      if (inject !== undefined && (!Array.isArray(inject) || inject.some(item => typeof item !== 'string'))) {
        throw new Error('desktop bridge: boot graph entry inject must be a string array')
      }
      if (row.immediately !== undefined && typeof row.immediately !== 'boolean') {
        throw new Error('desktop bridge: boot graph entry immediately must be boolean')
      }
      return {
        id: stringField(row, 'id'),
        url: stringField(row, 'url'),
        rev: stringField(row, 'rev'),
        ...(inject === undefined ? {} : { inject: [...inject as string[]] }),
        ...(row.immediately === true ? { immediately: true } : {}),
      }
    }),
  }
}
