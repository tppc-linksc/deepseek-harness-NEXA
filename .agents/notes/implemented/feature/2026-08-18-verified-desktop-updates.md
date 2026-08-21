# Agent Note: Verify desktop release updates before installation

Status: implemented

English | [中文](2026-08-18-verified-desktop-updates.zh.md)

## Problem

The desktop fork publishes native installers independently from the official DeepSeek Harness releases. Users need an in-app path from version discovery to the correct installer without confusing an official upstream release with a NEXA desktop release, downloading an artifact for the wrong operating system or CPU architecture, or trusting a partial download. Maintainers also need a reliable signal when the official repository publishes a newer Harness release, but an upstream release cannot be forwarded automatically because the desktop carrier may require source integration and regression work.

## Decision

The desktop bundle includes a desktop-only update plugin that calls private Electron main-process routes. Its dedicated Application Update settings section displays the installed NEXA version, supports manual checks, stores an opt-in daily-check preference, and reports download progress. The panel uses three bounded rows: current version, a semantic automatic-check switch, then the manual check action with its adjacent status; download progress and later installer actions remain conditional below them. Notification and installer timing are owned by the later [non-blocking desktop update handoff](../bug-fix/2026-08-21-nonblocking-desktop-update-handoff.md), which supersedes the original one-step approval: discovery is non-blocking, downloading is one explicit action, and opening the verified installer is a separate completion action. The Web UI and other bundles do not mount this plugin, and the update flow does not add an HTTP listener or expose its state outside the Electron process.

GitHub Releases for `tppc-linksc/deepseek-harness-NEXA` are the desktop update authority. The client queries the Releases API so stable and prerelease builds participate in discovery, ignores drafts, recognizes both `nexa-v<semver>` and the legacy `desktop-v<semver>` tag family, and selects the highest semantic version. A release at or below the installed version is current even when it has no manifest; a newer release must provide a `stable.json` asset, and the manifest version must equal the selected tag version. Missing material for a newer release, rate limiting, transport failure, other HTTP failure, and invalid release data remain distinct user-visible outcomes.

A published release contains exactly one supported artifact for each current target: macOS ARM64 DMG, Windows x64 NSIS EXE, and Linux x64 AppImage. Each native build rejects an incomplete deployed runtime before packaging: macOS requires the PTY addon and executable spawn helper, Windows requires both ConPTY addons plus its compatibility library and OpenConsole helper, and Linux requires its PTY addon. The release workflow generates `stable.json` and `SHA256SUMS.txt` from those artifacts after all native build jobs finish. Tags whose semantic version contains a prerelease suffix create a GitHub prerelease; stable versions become the latest stable release. The manifest names the NEXA version, release notes, integrated upstream version and commit, and the platform, architecture, installer type, file name, URL, byte length, and SHA-256 digest of every artifact. The client accepts only the supported schema, HTTPS links owned by the fork repository, expected installer extensions, and bounded artifact sizes.

Downloads are streamed to an update-specific private directory with a `.part` suffix. The manager enforces the declared byte length and maximum size while streaming, calculates SHA-256 before promotion, and stores staged metadata only after the file is complete. Startup recovery recalculates the digest before restoring a staged installer. Opening the installer recalculates it again, so an artifact changed after download is rejected. macOS opens the DMG and then exits the running app, Windows opens the NSIS installer and exits the running app, and Linux opens the AppImage after making it executable. A failed opener leaves the app running. The application does not silently replace itself, execute source code from the manifest, or claim that checksum verification is a code signature.

A scheduled upstream monitor checks official `deepseek-ai/deepseek-harness` release tags against `.nexa/upstream.json`. A newer official tag creates one repository issue containing the old and new upstream versions and commits. A maintainer reviews and integrates the change, updates `.nexa/upstream.json`, runs the desktop checks, and publishes a separately versioned NEXA release through the protected `desktop-release` environment. Official upstream discovery never publishes an installer automatically.

## Alternatives considered

**Use Electron `autoUpdater` for unattended replacement.** Its production path assumes signed and platform-specific update feeds, while this fork currently distributes unsigned or ad-hoc installers. Opening a verified native installer provides one consistent contract across the three supported targets without pretending to offer silent installation.

**Send users to the Releases page for every update.** This removes download code but makes users identify the correct target and verify its digest manually. The private update plugin can make those deterministic choices without changing the official Harness interface outside the desktop composition.

**Treat official DeepSeek releases as the client update feed.** Official tags do not publish this fork's Electron artifacts and do not identify which NEXA source revision contains the integration. NEXA releases therefore remain the only client-visible update authority.

**Publish automatically when the upstream monitor finds a tag.** Even a dependency-only upstream change can alter the embedded Web UI, session format, plugin loading, or desktop packaging. A maintainer-owned integration and release approval keeps those changes reviewable before distribution.

## Consequences

Desktop users receive an automatic daily notification or can check manually from a dedicated settings section. Version, preference, and check status remain visible without horizontal settings-panel overflow. One action downloads only the current platform artifact, reports progress, and verifies its size and digest; a later action reverifies and opens it. Update files and preferences remain separate from Web UI sessions and settings. A failed check, download, or opener leaves the installed application usable, and partial files are never offered for installation.

The desktop release repository and its HTTPS delivery remain trusted: a SHA-256 value published beside an artifact detects accidental corruption and post-download modification but does not protect against compromise of the release authority. Unsigned operating-system warnings and manual installation remain visible. Maintainers must integrate official updates, update the recorded upstream revision, approve the release environment, and keep the manifest and three native artifacts consistent.
