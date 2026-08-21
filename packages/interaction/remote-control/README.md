# @deepseek-ai/dsh-remote-control

English | [中文](README.zh.md)

Host-side integration between DeepSeek Harness NEXA and NEXA Remote. It owns the computer identity, encrypted peer keys, Relay connection, pairing QR lifecycle, remote command adapter, and the `remoteControl` Typert namespace used by the settings UI.

The computer remains authoritative. Phone instructions enter through `ctx.apiProxy.sessions.prompt`, wait for the addressed Agent to become idle, and return their final status. DSH approval requests are offered to a paired phone through the existing `approval/request` waterfall; an absent phone falls through to the local answerer, while a phone grant can only return `allowed-once`.

## Configuration

| key | meaning |
|---|---|
| `statePath` | Required private JSON state path for the computer identity, preferences, and encrypted-channel peer keys. The file is written with mode `0600`. |
| `enabled` | Initial connection preference used when no state file exists. Defaults to `true`. |
| `relayUrl` | Initial `ws://` or `wss://` Relay URL. Defaults to `ws://127.0.0.1:8080`. Public deployments must use `wss://`. |
| `computerName` | Initial name shown in the pairing QR. |

The generated Remote exposes `state`, `configure`, `reconnect`, `openPairing`, `confirmPairing`, and `revoke`. No private key is returned by any method. Pairing QR payloads expire after five minutes and still require explicit confirmation on the computer.

## Model Experience

Indirectly, through ordinary Session input and the existing approval service after authenticated phone actions pass the Host admission boundary.

#### KV Cache effect

No package-owned request prefix; admitted Session messages and approval outcomes follow their existing consumers' cache behavior.

## Known Limitations and Deferred Work

- The local state file is permission-restricted but not yet backed by Keychain, DPAPI, or another OS secure store.
- Real-device WeChat networking and SOTER biometric approval remain release gates outside this Host package.
- A public Relay requires TLS termination and persistent Redis configuration; the localhost default is development-only.
