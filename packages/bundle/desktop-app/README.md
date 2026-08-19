# @deepseek-ai/dsh-desktop-app

English | [中文](README.zh.md)

Desktop profile layer for DeepSeek Harness. It replaces the Web profile's HTTP/WebSocket carrier with a pull-driven Electron UtilityProcess bridge while retaining the same client plugin graph and product identity.

The Electron main process sets `DSH_HOME` and `DSH_AGENTS_HOME` only in the utility-process environment. Sessions, settings, credentials, profile files, plugin installations, storage, and agent configuration therefore live under the desktop application's Electron `userData/runtime` directory without changing the Web or CLI home. Electron main owns Chromium state and the sibling desktop log directory.

The renderer loads from the privileged standard `dsh://app` protocol. `/api`, `/plugins`, and extension-owned WebServer requests cross the utility-process message port; no TCP listener is created by this profile. Registered exact and longest-prefix WebServer routes run before the logical Connection fallback, matching the Web carrier's route precedence for same-origin extension endpoints. The bridge carries `DELETE`, `GET`, `HEAD`, `OPTIONS`, `PATCH`, `POST`, and `PUT`, buffers request bodies within the desktop limit, and streams ordinary and SSE responses through the existing pull channel. After the desktop authority is validated, Node-style routes receive synthetic loopback HTTP host, Origin, and peer values so their ordinary local-request guards remain usable; explicit foreign origins remain unchanged for route-owned rejection.

The bundle mounts the community `dshmarket` package as the **Extension Center** for extension discovery, lifecycle management, diagnostics, and live theme selection. Its Installed extensions view reports community packages that the center manages or recognizes in the desktop profile; the separate **Runtime components** settings section reports components currently loaded by the Host, so the lists need not match. The market's ordinary WebServer routes run on an in-memory compatibility service and remain reachable only through the same private custom-protocol bridge. Desktop-aware market operations receive an immutable `desktopProfiles.current` identity and a `desktopPnpm` service that runs the official `dsh plugin --profile desktop` CLI through the managed subprocess capability. One package operation may run at a time, and the operation remains active until its complete process tree exits.

The bundle also adds `@deepseek-ai/dsh-client-ui-desktop-update` as a dedicated Application Update settings section. Its browser half calls `/_desktop/update/*` on `dsh://app`; Electron main handles those private routes before Host forwarding, so update discovery, download storage, verification, and installer opening never grant those privileges to a browser plugin or the UtilityProcess.

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
- **Raw socket upgrades are not available** — ordinary HTTP and SSE routes work through the custom protocol, but WebSocket and other `registerUpgrade()` routes require a listening network carrier and fail during desktop composition.
- **Market entries execute third-party code** — the bundled market restricts installation to its curated catalog and blocks lifecycle scripts by default, but users must still review a plugin's source and requested capabilities before installation.
- **Updates require operating-system interaction** — one user approval downloads, verifies, and opens the current platform installer. Windows exits into NSIS; macOS and Linux open the DMG or AppImage. The application does not replace itself or claim a silent cross-platform restart.
