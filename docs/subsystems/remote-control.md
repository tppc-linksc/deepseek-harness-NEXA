# Remote Control

English | [中文](remote-control.zh.md)

The opt-in NEXA Remote bridge in [dsh-qrcode-remote](../../packages/interaction/qrcode-remote) lets a paired WeChat Mini Program observe sessions, append an instruction, stop an active run, or answer a pending approval without creating a second agent runtime. The computer remains authoritative: it owns the long-term identity and peer records, requests an expiring direct-launch Mini Program code from the Relay, confirms the phone fingerprint, admits commands through the existing Session API, and may revoke a phone at any time.

Source: [`packages/interaction/qrcode-remote/src/index.ts`](../../packages/interaction/qrcode-remote/src/index.ts)

## Connection, pairing, and persistence

`RemoteControlService` owns one NEXA `RemoteHost` and exposes its safe control plane through the `remoteControl` Typert namespace. The Relay only routes opaque frames; authenticated X25519-derived peer channels encrypt application messages end to end. Production uses the fixed, UI-hidden `wss://relay.tppc.top` endpoint; only explicit development configuration permits a custom address. Once connected, Settings automatically requests and refreshes a pairing offer. The offer asks the Relay for a WeChat Mini Program code containing only a short random `scene`; WeChat opens the pairing page directly, and the page exchanges `scene` for the signed, expiring `NEXA:` challenge. If server-only WeChat credentials are unavailable, Settings labels and renders the legacy payload for in-Mini-Program scanning. Scanning is not sufficient: Settings shows the proposed phone fingerprint and requires explicit confirmation on the computer before the peer becomes trusted.

The Host persists the computer identity, encrypted-channel peer keys, preferences, and revocation markers by atomic replacement at the configured `statePath`, then enforces file mode `0600`. `RemoteControlState` and `RemoteControlPairingOffer` are browser-safe projections: neither returns a private identity key nor a peer channel key. The settings UI is therefore a control surface, not a cryptographic owner.

## Command and event boundary

The phone never calls an Agent implementation directly. `DshRemoteHarnessAdapter` maps `append_instruction` to `ctx.apiProxy.sessions.prompt` with queue admission and maps `stop` to the Session cancellation API. It rejects every other action, waits for the addressed Agent to become idle, and returns the final accepted or rejected status. Session events and bounded snapshots travel back through the encrypted NEXA channel, preserving the Host as the only source of session truth.

## Approval fallback

The bridge prepends an answerer to the existing `approval/request` waterfall. It claims a request only while a non-revoked paired phone is connected; otherwise it calls the next local answerer. A remote grant is normalized to the existing one-shot `allowed-once` outcome, so pairing cannot weaken the DSH approval policy or create a durable permission. The approval service still owns policy enforcement and audit events.

## Release boundaries

The bundle ships disabled unless `DSH_REMOTE_ENABLED=1` seeds the first-run preference. Public deployments must provide durable Redis state and WeChat server credentials behind the managed Relay. Local testing sets `DSH_REMOTE_RELAY_URL=ws://127.0.0.1:8080` and `DSH_REMOTE_ALLOW_CUSTOM_RELAY=1`. The current file is permission-restricted but is not yet stored in Keychain, DPAPI, or another OS secure store; real-device WeChat networking and SOTER biometric approval remain release gates.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxremotecontrol--remotecontrolservice"></a>

### `ctx.remoteControl` — `RemoteControlService`

Host-owned remote connection, pairing state, and typed settings actions.

```ts cordis-catalog
/**
 * Project the current control plane without private key material.
 * @returns current browser-safe connection, pairing, and device state.
 */
@Remote('state') state(): RemoteControlState

/**
 * Persist preferences and restart the Relay connection.
 * @param request - complete replacement preference set from settings.
 * @returns state after the restart attempt settles.
 */
@Remote('configure') async configure(request: RemoteControlConfigureRequest): Promise<RemoteControlState>

/**
 * Retry the currently configured Relay immediately.
 * @returns state after an explicit Relay reconnection attempt settles.
 */
@Remote('reconnect') async reconnect(): Promise<RemoteControlState>

/**
 * Open a computer-side pairing window for the configured name.
 * @returns expiring Mini Program payload and rendered QR data URL.
 */
@Remote('openPairing') async openPairing(): Promise<RemoteControlPairingOffer>

/**
 * Accept the phone proposal currently visible to the user.
 * @returns state after confirming the currently pending phone proposal.
 */
@Remote('confirmPairing') confirmPairing(): RemoteControlState

/**
 * Revoke one known phone and persist the invalidated peer.
 * @param request - device identity selected in settings.
 * @returns state containing the revoked device marker.
 */
@Remote('revoke') revoke(request: RemoteControlRevokeRequest): RemoteControlState
```

Source: [`packages/interaction/qrcode-remote/src/index.ts:383`](../../packages/interaction/qrcode-remote/src/index.ts)
<!-- END GENERATED cordis-surface -->
