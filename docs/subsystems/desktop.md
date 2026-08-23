# Desktop Application Services

English | [中文](desktop.zh.md)

The desktop profile provides `ctx.desktopProfiles` and `ctx.desktopPnpm` for desktop-aware community plugins such as [`dshmarket`](https://github.com/dsh-market/dsh-market). These services exist only inside the Electron UtilityProcess. They expose the isolated desktop profile and run official `dsh plugin --profile desktop` operations without opening an HTTP port or granting package-management privileges to the renderer. The same profile also carries extension HTTP routes and client slots through the private `dsh://app` surface.

Source: [`packages/bundle/desktop-app/src/desktop-market-services.ts`](../../packages/bundle/desktop-app/src/desktop-market-services.ts)

## Runtime ownership

Electron main supplies absolute paths for the desktop profile, Harness home, command runtime, packaged DSH CLI, packaged pnpm, and application executable. Startup rejects missing or relative paths. The profile identity is immutable for one Host generation, and plugin changes take effect after restarting the application.

Package operations execute through the managed subprocess service. A private runtime directory contains only launcher-owned Node and pnpm shims; it is not added to the Web or CLI environment. One operation may run at a time, and the service keeps that slot occupied until the complete child process tree exits. Cancellation and Host teardown terminate the same managed tree.

## Extension transport compatibility

Registered exact and longest-prefix WebServer routes run before the logical Connection fallback, matching the Web application's route precedence. The desktop bridge carries `DELETE`, `GET`, `HEAD`, `OPTIONS`, `PATCH`, `POST`, and `PUT`, request streams, common `IncomingMessage` and `ServerResponse` header methods, open SSE responses, cancellation, and response backpressure. It presents validated desktop requests as loopback HTTP for extension-owned local-request guards while preserving an explicit foreign Origin for rejection. Request bodies are buffered up to 160 MiB before crossing the process channel. WebSocket and other raw socket upgrades are not available because the custom protocol has no listening socket.

Source: [`packages/bundle/desktop-app/src/portless-webserver.ts`](../../packages/bundle/desktop-app/src/portless-webserver.ts)

## Extension UI composition

The `sidebar.footer.action` list is a one-column grid above the footer row. Every full-width registrant receives one row, and direct children are constrained to the sidebar width. The bottom row gives `sidebar.settings` the remaining width and renders compact `sidebar.footer.trailing` icon actions at the right edge; NEXA Remote uses that seat for its 36-pixel connection icon. The collapsed rail stacks the same controls vertically. Registrants continue to own their buttons and portalled-panel presentation.

Source: [`packages/client/ui-sidebar/src/client/SidebarRoot.module.css`](../../packages/client/ui-sidebar/src/client/SidebarRoot.module.css)

## Startup diagnostics

The Host loader still fails loudly when an installed extension cannot activate. Electron catches that fatal result before the renderer is required, shows a localized native dialog with the loader error, and offers the desktop profile and Host log locations. The application does not silently remove, disable, or rewrite an extension during recovery.

Source: [`apps/desktop/src/host-failure.ts`](../../apps/desktop/src/host-failure.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxdesktoppnpm--desktoppnpmservice"></a>

### `ctx.desktopPnpm` — `DesktopPnpmService`

Package-manager service that runs one official DSH plugin operation at a time.

```ts cordis-catalog
/**
 * Run packaged pnpm directly in the active desktop profile.
 * @param args - pnpm arguments following its JavaScript entry.
 * @param signal - optional operation cancellation.
 * @returns live output streams and completion.
 */
run(args: readonly string[], signal?: AbortSignal): DesktopPnpmHandle

/**
 * Run the official `dsh plugin` command against the desktop profile.
 * @param args - plugin subcommand arguments supplied by the market.
 * @param invokingDir - absolute directory anchoring relative package specifications.
 * @param signal - optional operation cancellation.
 * @returns live output streams and completion.
 */
runPlugin(args: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
```

Source: [`packages/bundle/desktop-app/src/desktop-market-services.ts:110`](../../packages/bundle/desktop-app/src/desktop-market-services.ts)

<a id="ctxdesktopprofiles--desktopprofiles"></a>

### `ctx.desktopProfiles` — `DesktopProfiles`

Structural service consumed by community desktop plugins.

Source: [`packages/bundle/desktop-app/src/desktop-market-services.ts:28`](../../packages/bundle/desktop-app/src/desktop-market-services.ts)
<!-- END GENERATED cordis-surface -->
