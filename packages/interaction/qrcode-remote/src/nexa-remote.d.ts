declare module 'nexa-remote/crypto' {
  export function generateIdentity(): {
    edPublicKey: Uint8Array
    edSecretKey: Uint8Array
    dhPublicKey: Uint8Array
    dhPrivateKey: Uint8Array
  }
  export function deviceId(publicKey: Uint8Array): string
  export function base64urlEncode(bytes: Uint8Array): string
  export function base64urlDecode(value: string): Uint8Array
  export function base32Encode(bytes: Uint8Array): string
  export function sha256(bytes: Uint8Array): Uint8Array
  export function utf8Bytes(value: string): Uint8Array
}

declare module 'nexa-remote/messages' {
  export const Decision: {
    readonly DECISION_ALLOW_ONCE: 1
    readonly DECISION_DENY: 2
  }
  export const EventKind: {
    readonly EVENT_MESSAGE: 1
    readonly EVENT_TOOL_OUTPUT: 2
    readonly EVENT_DIFF: 3
    readonly EVENT_STATUS: 4
    readonly EVENT_INTERACTION: 5
  }
  export function encodePairingChallenge(value: unknown): Uint8Array
}

declare module 'nexa-remote/host' {
  export interface NexaIdentity {
    edPublicKey: Uint8Array
    edSecretKey: Uint8Array
    dhPublicKey: Uint8Array
    dhPrivateKey: Uint8Array
    deviceId: string
  }

  export interface NexaPeer {
    devicePub: Uint8Array
    deviceDhPub?: Uint8Array
    txKey: Uint8Array
    rxKey: Uint8Array
    pairedAt?: number
    revoked?: boolean
  }

  export interface NexaPairingChallenge {
    computerPubkey: Uint8Array
    computerPubFingerprint: string
    protocolVersion: number
    relayUrl: string
    expiresAt: number
    computerDhPubkey: Uint8Array
    pairingNonce: Uint8Array
    computerName: string
    launch?: {
      mode: 'miniprogram-code' | 'fallback-qr'
      imageDataUrl?: string
      payload?: string
      reason?: string
      scene: string
      expiresAt: number
    }
  }

  export interface NexaPairingProposal {
    deviceId: string
    devicePub: string
    expiresAt: number
  }

  export interface NexaHarnessAdapter {
    getSessionSnapshot(): Promise<unknown>
    getSessionHistory(
      sessionId: string,
      options?: { beforeCursor?: number; maxMessages?: number },
    ): Promise<{
      events: Array<{ sessionId: string; cursor: number; kind: number; payload: unknown }>
      hasMore: boolean
    }>
    subscribeEvents(callback: (event: {
      sessionId: string
      cursor: number
      kind: number
      payload: unknown
    }) => void): () => void
    setApprovalRequester(callback: (request: unknown) => Promise<number>): void
    executeCommand(
      sessionId: string,
      text: string,
      meta: { commandId: string; action: string },
    ): Promise<{ status: 'completed' | 'rejected'; result: string }>
  }

  export class RemoteHost {
    constructor(options: {
      identity: NexaIdentity
      relayUrl: string
      peerStore?: Map<string, NexaPeer>
      harness: NexaHarnessAdapter
      log?: Pick<Console, 'debug' | 'error' | 'info' | 'warn'>
      onPeerChanged?: (deviceId: string, peer: NexaPeer) => void
    })
    pendingProposal: NexaPairingProposal | null
    onPairingPendingUser?: (proposal: NexaPairingProposal) => void
    start(): Promise<void>
    close(): void
    openPairing(options?: {
      ttlMs?: number
      computerName?: string
      authorizePairing?: boolean
    }): Promise<NexaPairingChallenge>
    confirmPendingPairing(): boolean
    requestApproval(request: {
      approvalId: string
      workspaceId?: string
      sessionId: string
      actionCategory?: string
      target?: string
      scope?: string
      level?: string
      requestDigest?: string
      createdAt?: number
      expiresAt: number
    }): Promise<number>
    activePeerId(): string | null
    pairedDevices(): Array<{ deviceId: string; pairedAt: number; revoked: boolean }>
    revoke(deviceId: string): void
  }
}
