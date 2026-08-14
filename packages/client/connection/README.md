# @deepseek-ai/dsh-client-connection

English | [中文](README.zh.md)

Connection is the GUI wire consumer and Host dispatcher. The client plugin mounts `ctx.connection`: one API client, the current surface's loopback status, an observable generation-scoped `hostDescription`, and a single-consumer connection loop. A successful handshake publishes the exact `host.describe` value before `onConnected`; generation loss and explicit stop clear it.

The Host root provides transport-independent `ctx.connection.dispatch(request, authority)` and a registry for dedicated RPC channels. Typert Remote interceptors claim their `/api` endpoints before the API Proxy fallback. The logical dispatcher pins native actions, settings and credential methods, model discovery with draft credentials, and agent-preset authoring to loopback authority; a trusted non-loopback Web authority reaches only the remaining method set. This fence stays a reachability policy, not authentication.

The `./web` adapter owns the physical browser carrier: HTTP routes and bounded Fetch bridging for unary and response calls, plus one downlink-only WebSocket each for `events.mux` and `events.host`. It classifies every request as loopback or trusted-host after applying the browser-trust fence in `src/api-request-trust.ts`. Every HTTP or upgrade request must use a loopback `Host` or a declared canonical `trustedHosts` authority; browser `Origin`, when present, must equal that authority, and explicit cross-site Fetch Metadata is rejected. Malformed trust entries fail plugin load. The [browser-trust Agent Note](../../../.agents/notes/implemented/architecture/2026-07-28-api-browser-trust-boundary.md) and [WebSocket downlink Agent Note](../../../.agents/notes/implemented/architecture/2026-08-04-websocket-downlink-carrier.md) own those rules.

The desktop surface selects `FetchApiClient`: unary calls, client responses, and the two SSE streams all use same-origin Fetch at `dsh://app`. Electron main carries each Fetch request over a validated UtilityProcess message protocol, and the desktop Host bridge dispatches it as loopback authority. No WebSocket or TCP server participates. The [portless desktop carrier Agent Note](../../../.agents/notes/implemented/architecture/2026-08-14-portless-electron-desktop-carrier.md) owns that process boundary.

The fixture carrier remains the serverless `?fixture` UI path, and the in-process carrier satisfies the same protocol without network I/O. The platform carriers and `ConnectionController` are internal; the exported handles and wire contracts stay transport-neutral.

## Model Experience

None, as Connection moves already-composed messages between client and Host; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **History resumes an unattached session** — opening history may create the host-side agent and add latency to the first open; there is no persistence-only read path.
- **Web and desktop requests are buffered before dispatch** — both carriers allow up to 160 MiB by default, sized for the default 100 MiB aggregate image limit after base64 expansion and envelope headroom. The limit is also the per-request resident-memory bound.
