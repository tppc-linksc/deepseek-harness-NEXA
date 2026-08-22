/** Browser-safe values crossing the remoteControl Typert boundary. */

/** Browser-visible lifecycle of the computer-to-Relay connection. */
export type RemoteControlPhase = 'connected' | 'connecting' | 'disabled' | 'disconnected' | 'error'

/** Persisted Host preferences; the product surface exposes enablement only. */
export interface RemoteControlPreferences {
  enabled: boolean
  relayUrl: string
  computerName: string
}

/** Safe projection of one paired phone. */
export interface RemoteControlDevice {
  deviceId: string
  pairedAt: number
  revoked: boolean
}

/** Browser-safe snapshot returned by the Host control plane. */
export interface RemoteControlState {
  phase: RemoteControlPhase
  relayMode: 'managed' | 'custom'
  preferences: RemoteControlPreferences
  computerId: string
  pairedDevices: RemoteControlDevice[]
  pendingDevice?: { deviceId: string; fingerprint: string; expiresAt: number }
  error?: string
}

/** Complete preference replacement accepted by the Host. */
export interface RemoteControlConfigureRequest {
  enabled: boolean
  relayUrl: string
  computerName: string
}

/** Expiring pairing material displayed by the sidebar connection action. */
export interface RemoteControlPairingOffer {
  qrDataUrl: string
  payload: string
  mode: 'miniprogram-code' | 'fallback-qr'
  fallbackReason?: string
  fingerprint: string
  computerName: string
  expiresAt: number
}

/** Device selector for an explicit revocation. */
export interface RemoteControlRevokeRequest {
  deviceId: string
}
