/** Browser object layer over the remoteControl Typert namespace. */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  RemoteControlConfigureRequest,
  RemoteControlPairingOffer,
  RemoteControlRevokeRequest,
  RemoteControlState,
} from '@deepseek-ai/dsh-qrcode-remote/types'

/** Remote namespace shape consumed by the browser controller. */
export interface RemoteControlRemote {
  state: () => Promise<RemoteResult<RemoteControlState>>
  configure: (request: RemoteControlConfigureRequest) => Promise<RemoteResult<RemoteControlState>>
  reconnect: () => Promise<RemoteResult<RemoteControlState>>
  openPairing: () => Promise<RemoteResult<RemoteControlPairingOffer>>
  confirmPairing: () => Promise<RemoteResult<RemoteControlState>>
  revoke: (request: RemoteControlRevokeRequest) => Promise<RemoteResult<RemoteControlState>>
}

/** Complete observable state owned by the mobile-connection action. */
export interface RemoteControlView {
  state: RemoteControlState
  offer: RemoteControlPairingOffer | null
  busy: string | null
  error: string | null
}

const INITIAL_STATE: RemoteControlState = {
  phase: 'disconnected',
  relayMode: 'managed',
  preferences: {
    enabled: false,
    relayUrl: 'wss://relay.tppc.top',
    computerName: 'DeepSeek Harness NEXA',
  },
  computerId: '…',
  pairedDevices: [],
}

function remoteError(result: Extract<RemoteResult<unknown>, { ok: false }>): Error {
  return new Error(`${result.error.code}: ${result.error.message}`)
}

/** Serializes explicit settings actions while allowing read-only polling. */
export class RemoteControlController {
  /** Snapshot observed through the sidebar action's selector hook. */
  readonly store: SnapshotStore<RemoteControlView> = createSnapshotStore({
    state: INITIAL_STATE,
    offer: null,
    busy: null,
    error: null,
  })

  private disposed = false
  private action: symbol | null = null

  constructor(private readonly remote: RemoteControlRemote) {}

  /** Refresh browser-safe state without replacing an active action. */
  async load(): Promise<void> {
    if (this.disposed) return
    try {
      const result = await this.remote.state()
      if (!result.ok) throw remoteError(result)
      if (this.canPublish()) this.publishState(result.value)
    } catch (error: unknown) {
      this.publishError(error)
    }
  }

  /**
   * Save the typed Host preference request and publish the resulting state.
   * @param request - connection preferences submitted by an authorized caller.
   */
  configure(request: RemoteControlConfigureRequest): Promise<void> {
    return this.run('configure', () => this.remote.configure(request), true)
  }

  /** Request an immediate Relay reconnect. */
  reconnect(): Promise<void> {
    return this.run('reconnect', () => this.remote.reconnect(), true)
  }

  /** Generate and publish a fresh expiring pairing QR offer. */
  async openPairing(): Promise<void> {
    if (this.disposed || this.action !== null) return
    const action = Symbol('openPairing')
    this.action = action
    // A pairing offer is single-use at the Relay. Remove the old image before
    // asking for a new window so a user can never rescan the consumed code.
    this.store.update((view) => { view.offer = null; view.busy = 'openPairing'; view.error = null })
    try {
      const result = await this.remote.openPairing()
      if (!result.ok) throw remoteError(result)
      if (this.canPublish(action)) {
        this.store.update((view) => { view.offer = result.value })
      }
    } catch (error: unknown) {
      this.publishError(error)
    } finally {
      if (this.canPublish(action)) {
        this.action = null
        this.store.update((view) => { view.busy = null })
      }
    }
  }

  /** Confirm the phone proposal currently waiting on the Host. */
  confirmPairing(): Promise<void> {
    // The displayed offer was consumed by the proposal being confirmed.
    return this.run('confirmPairing', () => this.remote.confirmPairing(), true)
  }

  /**
   * Revoke one paired phone.
   * @param deviceId - stable phone identity selected by the user.
   */
  revoke(deviceId: string): Promise<void> {
    return this.run('revoke', () => this.remote.revoke({ deviceId }), true)
  }

  /** Prevent late Remote responses from publishing after plugin disposal. */
  dispose(): void {
    this.disposed = true
    this.action = null
  }

  private async run(
    name: string,
    operation: () => Promise<RemoteResult<RemoteControlState>>,
    clearOffer: boolean,
  ): Promise<void> {
    if (this.disposed || this.action !== null) return
    const action = Symbol(name)
    this.action = action
    this.store.update((view) => { view.busy = name; view.error = null })
    try {
      const result = await operation()
      if (!result.ok) throw remoteError(result)
      if (this.canPublish(action)) {
        this.store.set({
          state: result.value,
          offer: clearOffer ? null : this.store.getSnapshot().offer,
          busy: name,
          error: null,
        })
      }
    } catch (error: unknown) {
      this.publishError(error)
    } finally {
      if (this.canPublish(action)) {
        this.action = null
        this.store.update((view) => { view.busy = null })
      }
    }
  }

  private publishState(state: RemoteControlState): void {
    this.store.update((view) => {
      view.state = state
      // A successful state refresh proves the RPC path is healthy again. Do
      // not leave a previous transient transport error pinned in the popover.
      view.error = null
      // As soon as a phone proposal exists, the Relay has consumed the window
      // behind this QR. Keeping the image visible invites an invalid rescan.
      if (state.pendingDevice !== undefined) view.offer = null
    })
  }

  private canPublish(action?: symbol): boolean {
    return !this.disposed && (action === undefined || this.action === action)
  }

  private publishError(error: unknown): void {
    if (this.disposed) return
    this.store.update((view) => {
      view.error = error instanceof Error ? error.message : String(error)
    })
  }
}
