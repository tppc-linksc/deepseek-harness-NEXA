# Agent Note: Run the community market through the portless desktop profile

Status: implemented

English | [中文](2026-08-18-portless-desktop-community-market.zh.md)

## Problem

The community DeepSeek Harness ecosystem already maintains a searchable plugin catalog, installation and update flows, diagnostics, and a live theme store in `dshmarket`. Reimplementing those functions inside NEXA would create a second catalog and lifecycle implementation. Mounting the Web-oriented package unchanged is also incomplete: its routes require the WebServer service, packaged Electron is not a plain Node executable, and package operations must never target the concurrently running Web UI profile or expose a new local HTTP port.

## Decision

The desktop bundle includes the pinned stable `dshmarket` package after the desktop carrier. Its client bundle remains part of the ordinary Harness client-plugin graph, so Settings, extension management, and theme switching use the community implementation without a private source fork. NEXA applies its desktop presentation changes through the package-manager patch: the community surface is named **Extension Center**, while the Host Loader and settings-namespace surface is named **Runtime components**.

The Discover view keeps search controls in normal flow and makes the category filters sticky. Initial spacing belongs to the search row rather than the scroll container, so content cannot scroll through a blank strip above the sticky filters.

The sidebar owns the additive geometry of `sidebar.footer.action`: its one-column grid gives every extension action an independent row above Settings in both expanded and rail layouts. Direct children are constrained to the column width, so a registrant's flex direction, wrapping, or flex-basis rules cannot move sibling entries into another horizontal column. Registrants own their controls and portalled panels rather than mutating sibling layout.

NEXA supplies the public desktop services consumed by the market. `desktopProfiles.current` identifies the immutable `desktop` profile under the desktop-owned `DSH_HOME`. `desktopPnpm.runPlugin()` invokes the packaged official DSH CLI with `plugin --profile desktop`; `desktopPnpm.run()` invokes the packaged pnpm entry. Both run Electron through `ELECTRON_RUN_AS_NODE`, import a private environment cleanup module, use private Node and pnpm shims, preserve the Electron target for native dependency installation, and execute through the existing managed subprocess service. Exactly one package operation owns the service until its complete process tree exits. Cancellation and Host teardown terminate that process tree.

The desktop profile also publishes a structural WebServer-compatible service that owns no socket. Exact and longest-prefix routes are registered in memory and run before unmatched requests fall through to the logical Connection dispatcher. Extension-owned `/api` endpoints therefore keep the same route precedence as the Web carrier. Requests received from Electron main over the existing `dsh://app` message bridge are converted to the Node request subset used by ordinary routes, then captured back into a Fetch `Response`. The bridge carries the safe Fetch method set, common request and response header operations, open SSE streams, cancellation, and response backpressure. After Electron main validates the desktop authority, the adapter presents its host, Origin, and peer address as a synthetic loopback HTTP request so ordinary extension route guards work without a listening socket. An explicit foreign Origin is preserved for same-origin rejection. Raw socket upgrade routes remain unsupported, and the compatibility port reports zero.

Electron main owns fatal Host presentation. A loader or activation failure before the renderer becomes usable opens a localized native dialog with the diagnostic, desktop profile directory, and Host log path. Opening either location does not mutate the profile; the application exits after the user dismisses the failure instead of disappearing without an explanation.

Electron main passes the physical application executable, packaged DSH and pnpm entries, Electron version, profile directory, and private command-runtime directory to the UtilityProcess. Every path remains beneath the desktop application namespace except immutable packaged executables. Web UI sessions, credentials, settings, plugin manifests, and logs are never selected by a market operation.

The packaged Host resolves bare plugin names from the profile even though Electron withholds the Node internal loader. The root Include resolves a profile package to its absolute entry before importing it; if a profile lookup cannot traverse a symlink into the application archive, resolution falls back to the ambient packaged installation. An explicitly supplied host module base remains authoritative. Community bundle rows therefore load from the same profile where the market installed their package, while in-box rows continue to load from `app.asar`.

## Verification

Focused tests cover exact and longest-prefix routing, extension-route precedence over the logical Connection fallback, safe Fetch methods, loopback HTTP compatibility headers, preservation of a foreign Origin, request bodies, captured response status and headers, open SSE streaming and cancellation, duplicate route ownership, launcher-input validation, immutable profile identity, official CLI arguments, independent desktop environment values, private command shims, operation locking through process-tree quiescence, startup-failure actions, additive footer geometry, and profile/host bare-package resolution without Node internal loader access. The desktop and desktop-bundle TypeScript project references compile together. A packaged Host smoke forces the internal loader unavailable and confirms that installed `dsh-tokenledger` and `dsh-usage-stats` bundles activate, join the desktop client graph, and receive successful responses from their extension-owned usage endpoints; the market client module also joins that graph without starting a listener.

## Alternatives considered

**Implement a NEXA-specific market and theme store.** Rejected because catalog curation, security policy, package lifecycle behavior, diagnostics, backups, and theme activation would diverge from the community package and require independent long-term maintenance.

**Run `dsh web` as a child and load the existing market over localhost.** Rejected because it restores a listening port, duplicates the desktop carrier, and risks selecting the Web profile and its state.

**Modify and bundle a private fork of `dshmarket`.** Rejected because the package already defines desktop host services. Implementing those published interfaces keeps community updates replaceable and confines Electron-specific code to NEXA.

**Call system Node and pnpm.** Rejected because users may not have compatible global tools and packaged Electron must control the Node ABI used by native plugin dependencies.

## Consequences

Desktop users receive the community Extension Center and theme store inside Settings, with install, update, uninstall, diagnostics, and live theme selection backed by the official profile mechanism. Installed extensions are packages the center manages or recognizes in the desktop profile; Runtime components are the Harness/Cordis components currently loaded by the Host. The two views serve different purposes and are not required to contain identical entries. Additional footer actions stack without depending on registrant CSS. Ordinary HTTP and SSE extension routes retain their Web behavior, while extensions requiring raw socket upgrades remain incompatible by construction. A failed extension activation produces visible recovery locations rather than an unexplained exit. The desktop application still creates no HTTP listener and keeps all mutable market state separate from Web and CLI profiles.

The market installs third-party executable code. Catalog inclusion is not endorsement, lifecycle scripts remain blocked unless the user explicitly permits them, and users must review repositories and capabilities before installation. NEXA must update the pinned market and pnpm versions deliberately and retain compatibility with the package's published desktop service interfaces.
