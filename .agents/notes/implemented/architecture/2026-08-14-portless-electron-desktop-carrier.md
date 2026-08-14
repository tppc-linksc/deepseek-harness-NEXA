# Agent Note: Portless Electron desktop carrier

Status: implemented

English | [中文](2026-08-14-portless-electron-desktop-carrier.zh.md)

## Problem

DeepSeek Harness needs a desktop application that preserves the complete Web GUI instead of creating a second interface with a permanently divergent feature set. Running the ordinary Web profile behind an Electron window would still bind a localhost port and would let a concurrently running Web process contend for profiles, sessions, settings, credentials, plugin installations, logs, and other writable state. The renderer also must not gain Node or preload privileges merely because it runs in a desktop window.

The existing RPC design separates logical messages from their physical carrier ([GUI layering and RPC protocol](2026-07-19-gui-layering-and-rpc-protocol.md)), but the Host connection dispatcher and client-module registry previously mounted their HTTP routes directly. A portless desktop carrier requires those logical services to remain usable without `dsh-host-webserver`.

## Decision

`apps/desktop` is an Electron application using the same product name, Web frontend dist, client-plugin graph, and `desktop` profile as the rest of DeepSeek Harness. It is not a separate brand or product fork. Electron main registers `dsh` as a privileged standard scheme before readiness and loads a sandboxed renderer from `dsh://app`; `nodeIntegration` is off, context isolation and Web security are on, and no preload API is exposed. Main serves the shell assets, manifest, and favicon and injects the current client boot graph into index.html. The script policy permits same-origin string evaluation because the client-plugin runner evaluates Host-supplied bundles with `new Function`; it does not permit remote script origins. macOS packaging generates the application icon from the Web product's whale favicon.

Electron main starts the built `dsh` launcher in one hidden `UtilityProcess` with `--profile desktop`. The desktop bundle layers over `base` and `web-app`, then disables Web startup/runtime, `dsh-host-webserver`, HTTP module and connection adapters, WebSocket HMR, and the browser directory-picker chooser. It enables the UtilityProcess bridge and the native directory-picker Host and Client adapters. Electron deliberately withholds the Node internals required by Cordis configuration HMR from packaged applications, so the desktop child marks its launcher invocation as startup-only for profile and Harness-home patch layers; editing either layer requires an application restart. The application owns utility-process start, fatal exit, cancellation, window lifecycle, and teardown; an unexpected Host exit rejects active requests and terminates the desktop process instead of leaving a disconnected renderer, and the renderer owns no Host process handle.

The connection root provides transport-independent `dispatch(request, authority)` and dynamic RPC-channel observation. Its `./web` adapter owns HTTP trust classification, Fetch bridging, routes, and WebSocket downlinks. The client-module root owns global Loader-fiber observation, the boot graph, bundle paths, and a Fetch method; its `./web` adapter owns the `/plugins` HTTP route and index tap. Client-package manifests resolve from the profile first and from the module installation second: deployments retain profile-local overrides, while the packaged profile can consume modules inside `app.asar` without relying on profile links that `createRequire` cannot traverse. These multi-entry Node packages disable code splitting so their explicit publication files each carry a complete dependency closure. This preserves the browser carrier while allowing the desktop bridge to call both logical services directly.

The renderer selects `FetchApiClient` for the `dsh:` scheme. Unary calls, `respond`, and both event streams use same-origin Fetch; the event streams retain the existing SSE codec. Electron main converts each request into a validated structured-clone message for the UtilityProcess, and the desktop bridge dispatches it with loopback authority. A response head crosses first; the body advances one chunk only after main sends a `pull` message, preserving stream backpressure. Abort and stream cancellation send `cancel`, and both receive sites validate and rebuild every process message before using it. Neither process creates an HTTP server or TCP listener.

Desktop and Web keep one product identity while using different writable runtime domains. Electron main sets `userData` to `<appData>/DeepSeek Harness/desktop`; Chromium state stays there, the Host receives `<userData>/runtime` and `<userData>/runtime/agents` as `DSH_HOME` and `DSH_AGENTS_HOME`, and Host output goes to `<userData>/logs/host.log`. The child environment removes an inherited `DSH_WEB_URL` so a desktop session cannot report another running surface as its own. A concurrent Web or CLI process continues using its existing homes and resources.

Installer packaging deploys the desktop application's production dependency closure, excludes declarations and source maps, removes the build machine's repository path from text bundles and metadata, and validates the target `node-pty` payload before Electron Builder runs. macOS uses the Web favicon-derived icon and an ad-hoc signature. The manually dispatched desktop-installer workflow builds unsigned Windows x64 NSIS and Linux x64 AppImage artifacts on native GitHub runners; it retains read-only repository permission and uploads only the installer files.

## Verification

Protocol tests reject malformed authorities, methods, ids, headers, bodies, response status values, chunks, and boot graphs. Client tests pin `FetchApiClient` and loopback authority selection for `dsh:`. Client-module tests pin global sibling-fiber observation, profile-first package resolution, installation fallback, and the required non-empty anchor list. Profile and built-launcher config tests pin the three-bundle template and prove the Web server and Web adapters are disabled while the desktop bridge is active. Path tests pin the desktop namespace, environment override, and startup-only patch marker. Renderer-shell tests pin the public static paths and the client evaluator policy. The packaged application's visible regression reaches Settings and the Workspace-scoped New Session view with an empty renderer console. A real Electron boot reaches a renderer only after the UtilityProcess publishes its graph, and per-PID inspection finds no TCP listening socket for Electron main, the renderer, or the Harness UtilityProcess. The release artifact check verifies the DMG checksum structure and application signature, then extracts `app.asar` and rejects credential files, session or log files, source maps, private-key material, common token formats, and local build paths.

## Alternatives considered

**Wrap the ordinary Web server in Electron.** This would leave a localhost listener, retain WebSocket and DNS-rebinding concerns inside the desktop application, and preserve the exact port and writable-home collisions the desktop carrier must remove.

**Rewrite the Web UI as a desktop-native interface.** A second UI would duplicate the plugin graph, wire folds, accessibility behavior, settings surfaces, and every later GUI feature. Reusing the shipped frontend makes Web UI changes arrive in both surfaces from one implementation.

**Run the Harness Host in Electron main.** Host lifecycle, plugin failures, agent subprocess activity, and renderer carriage would then share the application control process. A UtilityProcess gives the Host an explicit environment and teardown unit while keeping one desktop application.

**Expose a broad contextBridge or Node-enabled renderer.** Client plugins are part of the renderer graph. Giving that graph filesystem or process APIs would enlarge every plugin's privilege and create a second desktop RPC surface outside the validated Harness protocol.

**Load the frontend from `file://`.** File origins do not provide the standard secure origin behavior required by module loading, Fetch, and same-origin routing. The standard `dsh://app` scheme supplies one local application origin without a server.

**Use Tauri while retaining the Node Host.** The existing Host, plugin loader, native dependencies, and subprocess lifecycle are Node-owned. A Tauri shell would still need to distribute and supervise a separate Node runtime and reproduce this message carrier across Rust and Node, increasing the platform and packaging surface without reducing the retained Host.

## Consequences

The desktop application follows the Web GUI without maintaining a second feature implementation, does not expose a TCP port, and can run beside `dsh web` without sharing writable application state. The renderer remains a Web-security principal rather than a privileged Node context, while the Harness Host retains its existing Node runtime and plugin model.

The costs are Electron distribution size, one additional process message protocol, two physical Connection adapters, and full-request buffering up to the 160 MiB desktop limit. Client-plugin graph changes reload the desktop window instead of using WebSocket HMR, while profile and Harness-home patch edits require a desktop restart. Packaging must include Electron, the Web dist, the built CLI, the desktop bundle, and the complete workspace dependency closure.
