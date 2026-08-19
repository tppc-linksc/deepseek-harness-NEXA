/** DeepSeek Harness desktop profile bridge for an Electron UtilityProcess. */

import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { addHarnessSourceSection } from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-client-modules'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { installDesktopMarketServices } from './desktop-market-services.ts'
import { PortlessWebServer } from './portless-webserver.ts'
import {
  parseDesktopMainMessage,
  type DesktopHostMessage,
  type DesktopMainMessage,
} from './protocol.ts'

/** Stable Cordis plugin name. */
export const name = 'desktop-app'

/** Services required before the desktop bridge can accept requests. */
export const inject = ['clientModules', 'connection', 'subprocess']

const SOURCE_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))

/**
 * Describe the desktop surface without changing the agent's task semantics.
 * @returns stable model-visible desktop carrier context.
 */
export function desktopSurfacePrompt(): string {
  return 'You are interacting with the user through the DeepSeek Harness desktop application. '
    + 'The renderer is a local custom-protocol client of this utility process; it does not expose an HTTP listening port.'
}

interface ParentPortLike {
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  off(event: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: DesktopHostMessage): void
}

interface UtilityProcessShape extends NodeJS.Process {
  parentPort?: ParentPortLike | null
}

interface ActiveResponse {
  readonly abort: AbortController
  reader?: ReadableStreamDefaultReader<Uint8Array>
  pulling: boolean
}

/**
 * Mount the pull-driven desktop request bridge and desktop surface context.
 * @param ctx - utility-process Host context.
 */
export function apply(ctx: Context): void {
  const parentPort = (process as UtilityProcessShape).parentPort
  if (parentPort === undefined || parentPort === null) {
    throw new Error('desktop-app: the desktop profile must run in an Electron UtilityProcess')
  }
  const portlessWebServer = new PortlessWebServer(ctx)
  installDesktopMarketServices(ctx)
  const active = new Map<string, ActiveResponse>()
  const send = (message: DesktopHostMessage): void => { parentPort.postMessage(message) }

  const finish = (id: string): void => {
    active.delete(id)
    send({ type: 'end', id })
  }

  const startRequest = async (message: Extract<DesktopMainMessage, { type: 'request' }>): Promise<void> => {
    if (active.has(message.id)) throw new Error(`desktop-app: duplicate request id ${JSON.stringify(message.id)}`)
    const abort = new AbortController()
    const state: ActiveResponse = { abort, pulling: false }
    active.set(message.id, state)
    const request = new Request(message.url, {
      method: message.method,
      headers: message.headers,
      ...(message.body === undefined ? {} : { body: Uint8Array.from(message.body).buffer }),
      signal: abort.signal,
    })
    const pathname = new URL(request.url).pathname
    const response = pathname === '/plugins' || pathname.startsWith('/plugins/')
      ? await ctx.clientModules.fetch(request)
      : await portlessWebServer.fetch(request, () => ctx.connection.dispatch(request, 'loopback'))
    if (!active.has(message.id)) return
    const reader = response.body?.getReader()
    if (reader !== undefined) state.reader = reader
    send({ type: 'response', id: message.id, status: response.status, headers: [...response.headers.entries()] })
    if (state.reader === undefined) finish(message.id)
  }

  const pull = async (id: string): Promise<void> => {
    const state = active.get(id)
    if (state?.reader === undefined || state.pulling) return
    state.pulling = true
    try {
      const next = await state.reader.read()
      if (!active.has(id)) return
      if (next.done) finish(id)
      else send({ type: 'chunk', id, chunk: next.value })
    } finally {
      state.pulling = false
    }
  }

  const cancel = (id: string): void => {
    const state = active.get(id)
    if (state === undefined) return
    active.delete(id)
    state.abort.abort()
    void state.reader?.cancel().catch(() => undefined)
  }

  const receive = (event: { data: unknown }): void => {
    let message: DesktopMainMessage
    try {
      message = parseDesktopMainMessage(event.data)
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }
    if (message.type === 'cancel') {
      cancel(message.id)
      return
    }
    const task = message.type === 'request' ? startRequest(message) : pull(message.id)
    void task.catch((error: unknown) => {
      cancel(message.id)
      send({ type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) })
    })
  }

  parentPort.on('message', receive)
  ctx.effect(() => () => {
    parentPort.off('message', receive)
    for (const id of active.keys()) cancel(id)
  }, 'desktop-app: utility-process bridge')

  ctx.effect(
    () => ctx.clientModules.onGraphChanged(() => { send({ type: 'ready', graph: ctx.clientModules.graph() }) }),
    'desktop-app: client graph updates',
  )
  const settled = ctx.get('loader')?.await()
  void Promise.resolve(settled).then(
    () => { send({ type: 'ready', graph: ctx.clientModules.graph() }) },
    (error: unknown) => { send({ type: 'error', message: error instanceof Error ? error.message : String(error) }) },
  )

  ctx.inject(['systemPrompt'], (promptCtx) => {
    addHarnessSourceSection(promptCtx, SOURCE_ROOT)
    promptCtx.systemPrompt.section({
      name: 'app:desktop-surface',
      order: -98,
      text: desktopSurfacePrompt,
    })
  })
}

export * from './protocol.ts'
export * from './desktop-market-services.ts'
export * from './portless-webserver.ts'
