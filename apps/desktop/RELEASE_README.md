# ⚠️ Unofficial DeepSeek Harness Desktop Wrapper

English | [中文](RELEASE_README.zh.md)

> **This is not an official DeepSeek release.** This fork packages the official DeepSeek Harness Web UI and agent runtime inside an Electron application shell. DeepSeek AI does not publish or support these installers.

## What this build contains

The desktop application reuses the official Web UI instead of replacing it. Electron starts the Harness Host in a child UtilityProcess and carries requests over a private process protocol; it does not start an HTTP server or expose a TCP listening port. Desktop sessions, settings, credentials, plugins, Chromium state, and logs use a desktop-owned application-data directory and do not share the running Web profile's writable files.

## Downloads

- macOS Apple Silicon: `DeepSeek-Harness-*-mac-arm64.dmg`
- Windows x64: `DeepSeek-Harness-*-win-x64.exe`
- Linux x64: `DeepSeek-Harness-*-linux-x64.AppImage`

## Installation

### macOS

The DMG uses an ad-hoc signature and is not notarized because this fork has no Apple Developer account. Drag the application to Applications. If macOS blocks the first launch, open System Settings → Privacy & Security and choose Open Anyway.

### Windows

The NSIS installer is not Authenticode-signed. Windows SmartScreen may show an unknown-publisher warning; continue only when the downloaded SHA-256 checksum matches the published checksum file.

### Linux

Make the AppImage executable, then run it:

```sh
chmod +x DeepSeek-Harness-*-linux-x64.AppImage
./DeepSeek-Harness-*-linux-x64.AppImage
```

## Privacy

- Session telemetry is hard-disabled in the desktop Host process.
- Prompts, attachments, tool results, and required request metadata are sent to the model provider selected by the user; the application is not an offline model runtime.
- The desktop carrier does not bind an HTTP or TCP listening port.
- Sessions, credentials, settings, and logs remain under the platform application-data directory unless a configured tool writes elsewhere with user approval.
- The release artifacts are scanned for private keys, common API-token formats, local absolute paths, and repository `.env` content before publication.

## Verification

Compare each download with `SHA256SUMS.txt` in the same release before opening it.

## Source and license

Source is published at [tppc-linksc/deepseek-harness-NEXA](https://github.com/tppc-linksc/deepseek-harness-NEXA). The upstream project is [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness). Code remains under the repository's [MIT license](../../LICENSE), with third-party notices in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
