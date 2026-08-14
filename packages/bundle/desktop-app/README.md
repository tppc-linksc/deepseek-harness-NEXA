# @deepseek-ai/dsh-desktop-app

English | [中文](README.zh.md)

Desktop profile layer for DeepSeek Harness. It replaces the Web profile's HTTP/WebSocket carrier with a pull-driven Electron UtilityProcess bridge while retaining the same client plugin graph and product identity.

The Electron main process sets `DSH_HOME` and `DSH_AGENTS_HOME` only in the utility-process environment. Sessions, settings, credentials, profile files, plugin installations, storage, and agent configuration therefore live under the desktop application's Electron `userData/runtime` directory without changing the Web or CLI home. Electron main owns Chromium state and the sibling desktop log directory.

The renderer loads from the privileged standard `dsh://app` protocol. `/api` and `/plugins` requests cross the utility-process message port; no TCP listener is created by this profile.

## Model Experience

### Desktop-surface context

#### What the model sees

The bundle adds the stable `app:desktop-surface` prompt section after the shared Harness source section. It identifies the renderer as a local custom-protocol client and states that the Host has no HTTP listening port; it does not change task instructions or tool policy.

#### Token effect

One prompt paragraph per session; constant for the lifetime of the Host.

#### KV Cache effect

Both source and desktop sections remain in the reusable prompt prefix, so they do not reduce KV-cache stability between turns.

## Known Limitations and Deferred Work

- **Profile patch edits require a restart** — packaged Electron cannot expose the Node internals Cordis configuration HMR requires; startup still applies both desktop-profile and Harness-home patch layers.
- **Request uploads are buffered before crossing processes** — Electron main rejects bodies above 160 MiB; response bodies remain pull-driven and streaming.
