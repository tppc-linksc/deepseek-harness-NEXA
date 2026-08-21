# @deepseek-ai/dsh-client-ui-desktop-update

English | [中文](README.zh.md)

Desktop-only Application Update surface for checking, downloading, verifying, and opening NEXA application updates. The dedicated settings entry keeps the manual **Check for updates** action visible instead of nesting it under General settings. Its compact rows show the current version first, a semantic switch for automatic checks second, and the manual action with its adjacent status third without widening the settings panel. The same controller also contributes a non-blocking lower-left shell notification for version discovery, background download progress, completion, and installer handoff. The Host half contributes no runtime behavior. The browser half calls Electron main's private `/_desktop/update/*` routes on `dsh://app` and validates every returned field before publishing it.

The package does not receive release URLs directly from plugin configuration and never receives a local installer path. Electron main owns the fixed release feed, target selection, storage, byte limits, SHA-256 verification, and installer launch. The desktop profile is the only bundle that installs this package.

## Model Experience

None, as the update row and its private application routes do not add prompts, tools, messages, or other values to a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Only published desktop targets can update in-app** — the current release set covers macOS arm64, Windows x64, and Linux x64; another platform or architecture remains usable but reports that no installer is available.
- **Operating-system installation remains authoritative** — an automatic daily check shows a non-blocking reminder. Downloading and installer handoff are separate user actions: the first downloads and verifies the selected target in the background, while the second reverifies it and opens the installer. Windows and macOS quit the running application after the installer opens successfully; an unsigned macOS build still requires the user to replace the application from the DMG and relaunch it. Linux opens the downloaded AppImage.
- **No release-note view inside settings** — the validated state carries the GitHub Release notes URL, but the row currently presents version and upstream information only.
