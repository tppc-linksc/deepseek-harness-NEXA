# DeepSeek Harness desktop

English | [中文](README.zh.md)

The desktop entry reuses the shipped Web client bundle and client-plugin graph inside an Electron window. The renderer uses `dsh://app`; Electron main forwards API and plugin requests to a hidden UtilityProcess with pull-based response backpressure. The application does not start the Web server or bind a TCP port.

The sandboxed renderer permits string evaluation because the client-plugin runner evaluates Host-supplied client bundles with `new Function`. Node integration remains disabled, no preload API exists, navigation stays on `dsh://app`, and script loading remains same-origin. Electron main serves the Web manifest and favicon beside the hashed frontend assets. macOS packaging derives the application icon from the same whale favicon instead of retaining Electron's default icon.

Desktop state is intentionally isolated without creating a separate product identity. Electron main uses `<appData>/DeepSeek Harness/desktop` as `userData`, passes its `runtime` and `runtime/agents` children as `DSH_HOME` and `DSH_AGENTS_HOME` only to the UtilityProcess, and writes process output to `logs/host.log`. A concurrently running `dsh web` continues to use its existing Harness and agent homes, sessions, settings, credentials, plugins, storage, logs, and listening port.

Application-update preferences, partial downloads, verified installers, and staging metadata live under the desktop-owned `updates` child. They never share the Web or CLI session directory, and removing an update download does not remove sessions, workspaces, plugins, settings, or credentials.

The UtilityProcess always receives `DSH_TELEMETRY_DISABLED=1`; the desktop distribution cannot upload session telemetry even when its parent environment opts in. Model requests still reach the provider configured by the user and retain the official provider headers documented by the owning adapter.

Electron does not expose the Node internals required by Cordis configuration HMR in a packaged application. The desktop Host therefore reads its profile and Harness-home `cordis.patch.yml` layers at startup; restart the desktop application after editing either file. Runtime-managed settings and credentials retain their own live update behavior.

## Extension Center

The desktop composition includes the community [dsh-market](https://github.com/dsh-market/dsh-market) plugin under **Settings → Extension Center**. It discovers, installs, backs up, and manages community extensions; its **Installed extensions** tab reflects packages that the Extension Center manages or recognizes in the desktop profile. **Runtime components** is a separate view of the Harness/Cordis components loaded by the current Host, so the two lists are not expected to stay identical. The **Themes** tab installs community themes and switches the active theme immediately when the theme supports live activation.

Install, update, and uninstall actions run the official `dsh plugin --profile desktop` command through the application's managed process-tree service and bundled pnpm release. The market writes only to the desktop-owned profile under `userData/runtime`; it cannot change the profile, sessions, settings, credentials, or plugins used by a concurrently running Web UI. Its WebServer-compatible routes are dispatched in memory through `dsh://app` and never open a TCP listener.

The sidebar gives each `sidebar.footer.action` extension its own grid row above Settings. Registrant flex direction, wrapping, and flex-basis rules therefore cannot push another extension off the sidebar; the collapsed rail gives each action the same 36-pixel row. The desktop request bridge gives extension-owned HTTP routes the same exact/longest-prefix precedence as Web, carries the standard safe Fetch methods, preserves local-request guards, and streams SSE responses. Raw socket upgrades remain unsupported because `dsh://app` has no listening socket.

Market listings and GitHub topic discovery are community curation, not DeepSeek or NEXA endorsement. Review the displayed repository and requested capabilities before installing third-party code. Package lifecycle scripts remain blocked unless the user explicitly allows them through the market flow.

If the Host cannot start after an extension change, Electron shows a native localized failure dialog before exiting. The dialog preserves the profile, reports the loader error, and can open either the desktop extension directory or `logs/host.log`; it never silently removes or disables a package.

## Application updates

The desktop main process queries the NEXA GitHub Releases API at most once per day by default, including stable and prerelease entries tagged `nexa-v<version>` or the legacy `desktop-v<version>`. Drafts are ignored and semantic-version precedence selects the newest entry. The dedicated **Application update** settings section can disable automatic checks or start a manual check immediately. A manifest is required only when the API reports a version newer than the installed application; one user confirmation then downloads the selected installer, verifies it, and opens the operating-system installation flow.

The release manifest is treated as untrusted input. It must name this repository's GitHub Release assets, match the current operating system and architecture, and provide an exact byte length and lowercase SHA-256 digest. The application streams the selected installer into a private `.part` file, rejects excess or missing bytes, verifies the digest, atomically stages the result, and verifies the staged file again before opening it. Local filesystem paths never reach the sandboxed renderer.

Installation remains an explicit operating-system flow. macOS opens the unsigned DMG so the user can replace the application and relaunch it. Windows opens the NSIS installer and exits the running application. Linux marks the AppImage executable before opening it. The application never replaces its own files, executes downloaded source code, or installs a release without user approval.

Published targets are macOS arm64 DMG, Windows x64 NSIS, and Linux x64 AppImage. Other operating-system or architecture combinations report that no installer is available.

## Build and release

Build the repository, then run `pnpm --filter @deepseek-ai/dsh-desktop start`. The platform scripts produce a macOS DMG, Windows NSIS installer, or Linux AppImage under `dist/installers`.

One NEXA release uses a `nexa-v<desktop-version>` tag. Before creating the tag, update the version of the desktop application, desktop bundle, and desktop-update client package together, record the included official Harness tag and full commit in `.nexa/upstream.json`, and prepare bilingual release notes. The `NEXA desktop release` workflow builds all three installers on native runners, validates the target-specific `node-pty` addons and helpers before packaging, waits for the `desktop-release` environment approval, and then publishes the installers, `SHA256SUMS.txt`, and `stable.json` as one GitHub Release. A version containing a prerelease suffix, such as `-rc.6`, produces a GitHub prerelease instead of replacing the latest stable release. `pnpm run release:desktop:manifest -- --assets <dir> --output <dir> --tag <tag>` performs the same metadata generation locally.

The scheduled `Official Harness update monitor` compares `.nexa/upstream.json` with the latest official `deepseek-ai/deepseek-harness` release. A mismatch opens one maintainer issue; it never merges upstream code or publishes a NEXA release automatically.
