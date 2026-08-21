# Agent Note: Keep desktop update discovery and installer handoff non-blocking

Status: implemented

English | [中文](2026-08-21-nonblocking-desktop-update-handoff.zh.md)

## Problem

Automatic update discovery opened a native modal over the application and treated approval as permission to download, verify, and open the installer in one operation. On macOS the DMG opened while the existing application remained active. Dragging the replacement from the DMG then failed because Finder could not replace an application that was still in use. The modal also interrupted active work before the user had chosen to download anything.

## Decision

The desktop update client registers an additive entry in the frame-wide `shell.overlay` slot and shares one update controller with the Application Update settings section. Automatic checks start before the renderer loads and publish only main-process state. The overlay loads that state and polls while a check, download, or installer handoff is active. Available, downloading, downloaded, installing, and error states render as an interactive lower-left card; quiet states render nothing. Dismissing a card hides only that phase and version for the current renderer lifetime, while the settings section continues to expose the authoritative action.

Download and installer handoff are separate explicit operations. The available card starts a streamed, verified background download and leaves the application usable. The downloaded card appears after verification and offers the platform-specific installer action. Staged metadata remains durable, so a verified installer returns as downloaded after an application restart. The renderer receives the installer format for accurate action copy but never receives the staged path.

On macOS, a successful `shell.openPath()` handoff is followed immediately by `app.quit()`. Finder can mount the DMG before application teardown, but the old application is gone before the user can drag its replacement. The application stays open when Launch Services rejects the DMG, preserving the error notice and a usable settings path. Windows keeps the same successful-open-then-quit rule for NSIS. Linux keeps the application open after starting the AppImage because launching the new image while the single-instance owner is shutting down is not a reliable restart mechanism.

The private renderer protocol exposes `download` and `install` as separate asynchronous routes. The combined `apply` route is removed rather than retained as a compatibility alias because the pre-release product has no external consumers and the one-step operation is the defective behavior.

## Alternatives considered

**Keep the native discovery modal and only quit macOS after opening the DMG.** This fixes Finder replacement but still interrupts active work and makes download consent inseparable from discovery.

**Open the installer immediately when the background download finishes.** Completion can occur long after the user's click and may terminate an active session without a current installation decision. A second action makes the interruption explicit.

**Quit before asking Launch Services to open the DMG.** Electron cannot complete an in-process `shell.openPath()` call after its process exits. A detached helper would add another executable lifecycle for no user benefit; opening the inert DMG first and quitting immediately still closes the application before manual replacement.

**Use Electron `autoUpdater` for an in-place restart.** The fork still distributes unsigned or ad-hoc installers and intentionally preserves the operating system's manual installation warnings. The verified native-installer flow remains the appropriate mechanism until signing and an update feed can support unattended replacement honestly.

## Consequences

Update discovery no longer blocks the workspace. Users can continue working during download, defer installation after completion, and recover the verified completion state after restarting the app. macOS no longer presents a mounted DMG beside a running copy that Finder cannot replace. The completion action is accurately described as quitting and opening the installer, not as a silent restart or self-replacement.

The client now polls the private state route at a fixed short interval only during active phases. The controller orders concurrent state responses and releases the action lock independently, so polling cannot strand a check or download as permanently busy. Unit coverage pins verification, failure, open-before-quit ordering, route separation, response ordering, dismissal, and phase restoration. A keyless assembled browser scenario loads the real built plugin through the product Loader, mocks only the Electron-owned private route, and records the available and downloaded notification surfaces.
