# Remote Control

English | [中文](remote-control.zh.md)

The opt-in NEXA Remote bridge in [dsh-qrcode-remote](../../packages/interaction/qrcode-remote) turns a paired WeChat Mini Program into an application-level controller for one computer. It can observe sessions, append or stop work, answer a pending approval, create a computer Session, register a computer project directory as a workspace, and update explicitly remote-writable settings without creating a second agent runtime. The computer remains the only execution authority: it owns every Session, Agent loop, model call, project, setting and tool action; the Mini Program never executes locally or becomes a second source of truth.

Source: [`packages/interaction/qrcode-remote/src/index.ts`](../../packages/interaction/qrcode-remote/src/index.ts)

## Connection, pairing, and persistence

`RemoteControlService` owns one NEXA `RemoteHost` and exposes its safe control plane through the `remoteControl` Typert namespace. The Relay only routes opaque frames; authenticated X25519-derived peer channels encrypt application messages end to end. Production uses the fixed, UI-hidden `wss://relay.tppc.top` endpoint; only explicit development configuration permits a custom address. `qrcode-remote` remains visible in the runtime component inventory, while its product entry is one compact **Connect mobile** icon in `sidebar.footer.trailing`, immediately to the right of Settings. Opening that icon establishes a short, single-use computer authorization window and renders an expiring WeChat Mini Program code. WeChat exchanges the random `scene` for the signed challenge, completes the phone proposal, receives the matching computer signature in the background, and opens the latest desktop session directly. Relay endpoints, computer IDs, fingerprints, device lists, reconnect buttons, an in-Mini-Program scanner, a second confirmation, and an “enter session” step are not part of the normal product flow.

Connection state follows the authenticated Host transport. The service retries an unexpected Relay loss with bounded exponential backoff, restarts a stale Host when a pairing window is requested, and clears transient browser errors after a successful state refresh. This keeps the product entry useful across network changes without exposing a manual Relay console.

The Host persists the computer identity, encrypted-channel peer keys, preferences, and revocation markers by atomic replacement at the configured `statePath`, then enforces file mode `0600`. `RemoteControlState` and `RemoteControlPairingOffer` are browser-safe projections: neither returns a private identity key nor a peer channel key. The sidebar popover is therefore only a narrow connection surface, not a cryptographic owner or device-management console.

## Application-control boundary

The phone never calls an Agent implementation directly. `DshRemoteHarnessAdapter` maps `session.append_instruction` to `ctx.apiProxy.sessions.prompt`, `session.stop` to the Session cancellation API, and `session.create` to `ctx.apiProxy.sessions.create`. Every mutation uses a versioned control request with an idempotency key; the Host replays completed results for retries and publishes the resulting computer snapshot instead of allowing the phone to predict success. Session events and bounded snapshots travel back through the encrypted NEXA channel, preserving the Host as the only source of Session truth. The snapshot includes every non-archived desktop Session, including a blank newly created Session; only archived and subagent Sessions remain outside the primary mobile list.

The projection preserves the desktop information hierarchy instead of exposing protocol noise. Its mobile drawer shows only the current computer name, online state, and workspace/Session tree; it does not repeat a profile, product explanation, or a Remote mirror/Connect computer mode switch, and it closes through the scrim or a left swipe instead of a large close control. User and Agent messages render directly. Tool events carry a concise action plus the concrete command, file, or test target; arguments, progress, and results remain collapsed until the user opens the card, and Markdown results use a safe rendering subset. The desktop `running` field drives the phone composer between send and stop, while a phone stop request is authoritative only after the Session cancellation result returns from the computer. History pages are selected by encoded byte budget below the Relay frame limit, with explicit truncation markers and `hasMore` pagination for oversized tool output. Authenticated snapshot, history, or live frames also override delayed offline presence, preventing a healthy synchronized Session from being labelled as reconnecting.

## Workspace and settings control

The Host publishes `workspace.roots.list`, `workspace.directory.list`, `workspace.register`, and `workspace.create` only when its adapter implements them. Directory results contain display names and short-lived opaque references rather than absolute paths. Each request resolves the reference again, proves that the canonical directory remains under an approved root on the same device, and rejects symlinks, mount escapes, hidden or sensitive directories, traversal, nested creation, and invalid names. P0 deliberately omits move, rename, delete, upload, and arbitrary file reads or writes. A failed create operation removes the new directory only when it is still empty.

The Host publishes `settings.get` and `settings.update` with descriptors for type, risk, current value and remote writability. P0 permits the computer name and keeps Relay configuration, credentials, authorization roots, security switches, and model configuration local-only. Updates include the expected `settings_revision` and a digest of the submitted setting; the computer rejects stale, unknown, mismatched, or disallowed writes and persists the new revision before the phone refreshes its projection.

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
 * Open a computer-side pairing window and authorize only that fresh challenge.
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

Source: [`packages/interaction/qrcode-remote/src/index.ts:667`](../../packages/interaction/qrcode-remote/src/index.ts)
<!-- END GENERATED cordis-surface -->
