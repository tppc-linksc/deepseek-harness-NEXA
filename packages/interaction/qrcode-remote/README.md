# @deepseek-ai/dsh-qrcode-remote

English | [中文](README.zh.md)

Host-side integration between DeepSeek Harness NEXA and NEXA Remote. The Web and desktop bundles mount it as the `qrcode-remote` Cordis entry, which makes it visible in **Runtime components → Component list**. It owns the computer identity, encrypted peer keys, Relay connection, pairing-code lifecycle, application-control adapter, and the `remoteControl` Typert namespace consumed by the **Connect mobile** sidebar action.

The computer is the sole execution authority. The Mini Program projects computer-owned workspaces, Sessions, messages, tool output, status, approval requests, and settings, then sends authenticated control requests back to that computer. It can request a new Session, append or stop work, register an existing project directory, create one project directory under a computer-approved root, and update settings that the Host marks remotely writable. It never runs an Agent, calls a model, stores a second authoritative Session, receives an absolute project path, or executes a tool locally. Phone instructions enter through `ctx.apiProxy.sessions.prompt`; DSH approval requests use the existing `approval/request` waterfall, where an absent phone falls through to the local answerer and a phone grant can only return `allowed-once`.

The mobile event stream follows the desktop information hierarchy. Ordinary messages render directly; tool calls expose a concise action plus the concrete command, file, or test target, while arguments, progress logs, and results stay collapsed until requested. Desktop Markdown results render through a safe Mini Program subset. The desktop `running` snapshot selects the phone's send or stop action, and a phone stop request reaches the same Session cancellation API. History is byte-paged below the Relay frame limit, so a large terminal result cannot strand the mobile client in a reconnect or loading state.

Workspace control is capability-negotiated and fail-closed. The Host exposes only short-lived opaque directory references under configured workspace roots, revalidates canonical paths and device boundaries for every request, excludes symlinks and sensitive or hidden directories, and permits only directory listing, existing-project registration, or one-level directory creation in P0. Remote move, rename, delete, upload, and arbitrary file I/O are absent. Settings use Host-provided descriptors, risk labels, an allowlist, content digests, and compare-and-swap revisions; Relay, credentials, authorization roots, and other local-only settings cannot be changed from the phone.

## Configuration

| key | meaning |
|---|---|
| `statePath` | Required private JSON state path for the computer identity, preferences, and encrypted-channel peer keys. The file is written with mode `0600`. |
| `enabled` | Initial connection preference used when no state file exists. Defaults to `true`. |
| `relayUrl` | Managed `ws://` or `wss://` Relay URL. Defaults to the fixed production endpoint `wss://relay.tppc.top`. |
| `allowCustomRelay` | Permits an explicit non-production Relay in development configuration. Defaults to `false`; no Relay editor is exposed in the product UI. |
| `computerName` | Initial name projected to the connected phone. |

The generated Remote exposes `state`, `configure`, `reconnect`, `openPairing`, `confirmPairing`, and `revoke` for typed Host control and diagnostics. No method returns a private key. Managed mode ignores browser-submitted Relay changes and never exposes an endpoint editor. Opening **Connect mobile** calls `openPairing`, authorizes only that fresh challenge, and refreshes it when it expires. With server-only WeChat credentials, the offer is a Mini Program code that launches the pairing route directly; an exact signed proposal is confirmed in the Host background and the phone opens the most recent desktop Session. The legacy `NEXA:` payload remains a development diagnostic fallback and is not shown as a product QR.

## Model Experience

Indirectly, through ordinary Session input and the existing approval service after authenticated phone actions pass the Host admission boundary.

#### KV Cache effect

No package-owned request prefix; admitted Session messages and approval outcomes follow their existing consumers' cache behavior.

## Known Limitations and Deferred Work

- The local state file is permission-restricted but not yet backed by Keychain, DPAPI, or another OS secure store.
- Real-device WeChat networking, Mini Program review, and SOTER biometric approval remain release gates outside this Host package.
- A public Relay requires TLS termination and persistent Redis configuration. Local Relay testing must set `DSH_REMOTE_RELAY_URL=ws://127.0.0.1:8080` and `DSH_REMOTE_ALLOW_CUSTOM_RELAY=1` explicitly.
