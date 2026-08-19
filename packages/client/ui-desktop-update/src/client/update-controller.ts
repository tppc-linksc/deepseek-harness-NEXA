/** Browser controller for Electron's private desktop update routes. */

import {
  createSnapshotStore, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Updater phases published by the Electron main process. */
export type DesktopUpdatePhase =
  | 'available'
  | 'checking'
  | 'downloaded'
  | 'downloading'
  | 'error'
  | 'idle'
  | 'installing'
  | 'unsupported'
  | 'up-to-date'

/** Renderer-safe update state. Local installer paths never cross this interface. */
export interface DesktopUpdateState {
  phase: DesktopUpdatePhase
  currentVersion: string
  automaticChecks: boolean
  availableVersion?: string
  upstreamVersion?: string
  releaseNotesUrl?: string
  downloadedBytes?: number
  totalBytes?: number
  lastCheckedAt?: string
  error?: string
}

type UpdateFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const phases: ReadonlySet<string> = new Set([
  'available', 'checking', 'downloaded', 'downloading', 'error', 'idle',
  'installing', 'unsupported', 'up-to-date',
])
const requiredFields = new Set(['phase', 'currentVersion', 'automaticChecks'])
const optionalStringFields = [
  'availableVersion', 'upstreamVersion', 'releaseNotesUrl', 'lastCheckedAt', 'error',
] as const
const optionalNumberFields = ['downloadedBytes', 'totalBytes'] as const
const acceptedFields = new Set([
  ...requiredFields, ...optionalStringFields, ...optionalNumberFields,
])

/**
 * Validate the private-route response before it reaches React.
 * @param value - parsed response JSON.
 * @returns validated renderer-safe state.
 */
export function parseDesktopUpdateState(value: unknown): DesktopUpdateState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('update state must be an object')
  }
  const state = value as Record<string, unknown>
  if (
    Object.keys(state).some(field => !acceptedFields.has(field))
    || [...requiredFields].some(field => !(field in state))
    || typeof state.phase !== 'string'
    || !phases.has(state.phase)
    || typeof state.currentVersion !== 'string'
    || state.currentVersion.length === 0
    || typeof state.automaticChecks !== 'boolean'
  ) {
    throw new Error('update state fields are invalid')
  }
  for (const field of optionalStringFields) {
    if (state[field] !== undefined && (typeof state[field] !== 'string' || state[field].length === 0)) {
      throw new Error(`update state ${field} is invalid`)
    }
  }
  for (const field of optionalNumberFields) {
    if (state[field] !== undefined && (!Number.isSafeInteger(state[field]) || (state[field] as number) < 0)) {
      throw new Error(`update state ${field} is invalid`)
    }
  }
  const releaseNotesUrl = state.releaseNotesUrl
  if (
    releaseNotesUrl !== undefined
    && (typeof releaseNotesUrl !== 'string'
      || !releaseNotesUrl.startsWith('https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/'))
  ) {
    throw new Error('update state releaseNotesUrl is invalid')
  }
  return state as unknown as DesktopUpdateState
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json()
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const error = (value as Record<string, unknown>).error
      if (typeof error === 'string' && error.length > 0) return error
    }
  } catch {
    // A non-JSON error response carries no safe detail; the status remains useful.
  }
  return `更新服务返回 HTTP ${response.status}`
}

/** Controller joining update reads and explicit user actions. */
export class DesktopUpdateController {
  /** Update state consumed through the slot renderer's bound selector hook. */
  readonly store: SnapshotStore<DesktopUpdateState> = createSnapshotStore({
    phase: 'idle',
    currentVersion: '…',
    automaticChecks: true,
  })

  private generation = 0
  private active = false

  /** @param fetcher - browser fetch implementation, injectable for tests. */
  constructor(private readonly fetcher: UpdateFetch = globalThis.fetch.bind(globalThis)) {}

  /** Load current state without triggering a network release check. */
  async load(): Promise<void> {
    await this.request('state', 'GET')
  }

  /** Run a user-requested release check. */
  async check(): Promise<void> {
    this.store.update((state) => { state.phase = 'checking'; delete state.error })
    await this.request('check', 'POST')
  }

  /** Begin the compatible installer download. */
  async download(): Promise<void> {
    await this.request('download', 'POST')
  }

  /** Download, verify, and open the compatible installer. */
  async update(): Promise<void> {
    await this.request('apply', 'POST')
  }

  /** Reverify and open the staged installer. */
  async install(): Promise<void> {
    await this.request('install', 'POST')
  }

  /**
   * Persist the automatic daily-check preference.
   * @param enabled - whether background checks are enabled.
   */
  async setAutomaticChecks(enabled: boolean): Promise<void> {
    await this.request('preferences', 'PUT', { automaticChecks: enabled })
  }

  /** Stop in-flight responses from publishing after plugin disposal. */
  dispose(): void {
    this.generation += 1
  }

  private async request(route: string, method: string, body?: unknown): Promise<void> {
    if (this.active && route !== 'state') return
    const generation = ++this.generation
    if (route !== 'state') this.active = true
    try {
      const init: RequestInit = {
        method,
        cache: 'no-store',
        ...(body === undefined ? {} : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      }
      const response = await this.fetcher(`/_desktop/update/${route}`, init)
      if (!response.ok) throw new Error(await errorMessage(response))
      const state = parseDesktopUpdateState(await response.json())
      if (generation === this.generation) this.store.set(state)
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((state) => {
        state.phase = 'error'
        state.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      if (route !== 'state' && generation === this.generation) this.active = false
    }
  }
}
