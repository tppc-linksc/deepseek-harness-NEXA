# @deepseek-ai/dsh-qrcode-remote

English | [中文](README.zh.md)

Host-side integration between DeepSeek Harness NEXA and NEXA Remote. The Web and desktop bundles mount it as the `qrcode-remote` Cordis entry, which makes it visible in **Runtime components → Component list**. It owns the computer identity, encrypted peer keys, Relay connection, pairing QR lifecycle, remote command adapter, and the `remoteControl` Typert namespace consumed by the separate **Remote Control** settings menu.

The computer remains authoritative. Phone instructions enter through `ctx.apiProxy.sessions.prompt`, wait for the addressed Agent to become idle, and return their final status. DSH approval requests are offered to a paired phone through the existing `approval/request` waterfall; an absent phone falls through to the local answerer, while a phone grant can only return `allowed-once`.

## Configuration

| key | meaning |
|---|---|
| `statePath` | Required private JSON state path for the computer identity, preferences, and encrypted-channel peer keys. The file is written with mode `0600`. |
| `enabled` | Initial connection preference used when no state file exists. Defaults to `true`. |
| `relayUrl` | Managed `ws://` or `wss://` Relay URL. Defaults to the fixed production endpoint `wss://relay.tppc.top`. |
| `allowCustomRelay` | Exposes Relay editing to Settings when `true`. Defaults to `false`; enable it only for local development or self-hosting. |
| `computerName` | Initial name shown in the pairing QR. |

The generated Remote exposes `state`, `configure`, `reconnect`, `openPairing`, `confirmPairing`, and `revoke`. No private key is returned by any method. Managed mode ignores browser-submitted Relay changes and never exposes the endpoint editor. Settings automatically calls `openPairing` after a connection is ready and refreshes an expired offer. When the Relay is configured with server-only WeChat credentials, the offer is a Mini Program code that users scan directly in WeChat; it falls back to the legacy `NEXA:` QR for development. Both modes expire after five minutes and still require explicit confirmation on the computer.

## Model Experience

Indirectly, through ordinary Session input and the existing approval service after authenticated phone actions pass the Host admission boundary.

#### KV Cache effect

No package-owned request prefix; admitted Session messages and approval outcomes follow their existing consumers' cache behavior.

## Known Limitations and Deferred Work

- The local state file is permission-restricted but not yet backed by Keychain, DPAPI, or another OS secure store.
- Real-device WeChat networking, Mini Program review, and SOTER biometric approval remain release gates outside this Host package.
- A public Relay requires TLS termination and persistent Redis configuration. Local Relay testing must set `DSH_REMOTE_RELAY_URL=ws://127.0.0.1:8080` and `DSH_REMOTE_ALLOW_CUSTOM_RELAY=1` explicitly.
