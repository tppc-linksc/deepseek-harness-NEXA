# DeepSeek Harness desktop

English | [中文](README.zh.md)

The desktop entry reuses the shipped Web client bundle and client-plugin graph inside an Electron window. The renderer uses `dsh://app`; Electron main forwards API and plugin requests to a hidden UtilityProcess with pull-based response backpressure. The application does not start the Web server or bind a TCP port.

The sandboxed renderer permits string evaluation because the client-plugin runner evaluates Host-supplied client bundles with `new Function`. Node integration remains disabled, no preload API exists, navigation stays on `dsh://app`, and script loading remains same-origin. Electron main serves the Web manifest and favicon beside the hashed frontend assets. macOS packaging derives the application icon from the same whale favicon instead of retaining Electron's default icon.

Desktop state is intentionally isolated without creating a separate product identity. Electron main uses `<appData>/DeepSeek Harness/desktop` as `userData`, passes its `runtime` and `runtime/agents` children as `DSH_HOME` and `DSH_AGENTS_HOME` only to the UtilityProcess, and writes process output to `logs/host.log`. A concurrently running `dsh web` continues to use its existing Harness and agent homes, sessions, settings, credentials, plugins, storage, logs, and listening port.

The UtilityProcess always receives `DSH_TELEMETRY_DISABLED=1`; the desktop distribution cannot upload session telemetry even when its parent environment opts in. Model requests still reach the provider configured by the user and retain the official provider headers documented by the owning adapter.

Electron does not expose the Node internals required by Cordis configuration HMR in a packaged application. The desktop Host therefore reads its profile and Harness-home `cordis.patch.yml` layers at startup; restart the desktop application after editing either file. Runtime-managed settings and credentials retain their own live update behavior.

Build the repository, then run `pnpm --filter @deepseek-ai/dsh-desktop start`. The platform scripts produce a macOS DMG, Windows NSIS installer, or Linux AppImage under `dist/installers`. The manually dispatched `Desktop installers (Windows and Linux)` GitHub Actions workflow builds the Windows and Linux formats on their native runners because the runtime includes native dependencies.
