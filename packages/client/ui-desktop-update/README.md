# @deepseek-ai/dsh-client-ui-desktop-update

English | [中文](README.zh.md)

Desktop-only Application Update settings section for checking, downloading, verifying, and opening NEXA application updates. The dedicated navigation entry keeps the manual **Check for updates** action visible instead of nesting it under General settings. Its compact rows show the current version first, a semantic switch for automatic checks second, and the manual action with its adjacent status third without widening the settings panel. The Host half contributes no runtime behavior. The browser half calls Electron main's private `/_desktop/update/*` routes on `dsh://app`, validates every returned field before publishing it, and renders download progress and any subsequent installer actions below those rows.

The package does not receive release URLs directly from plugin configuration and never receives a local installer path. Electron main owns the fixed release feed, target selection, storage, byte limits, SHA-256 verification, and installer launch. The desktop profile is the only bundle that installs this package.

## Model Experience

None, as the update row and its private application routes do not add prompts, tools, messages, or other values to a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Only published desktop targets can update in-app** — the current release set covers macOS arm64, Windows x64, and Linux x64; another platform or architecture remains usable but reports that no installer is available.
- **Operating-system installation remains authoritative** — an automatic daily check prompts when a release is available; one user approval downloads the selected target, verifies its SHA-256 digest, and opens the installer. Windows exits into its installer. An unsigned macOS build opens the DMG, after which the user replaces the application and relaunches it. Linux opens the downloaded AppImage.
- **No release-note view inside settings** — the validated state carries the GitHub Release notes URL, but the row currently presents version and upstream information only.
