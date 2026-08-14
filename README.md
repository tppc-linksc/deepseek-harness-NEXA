# ⚠️ Unofficial DeepSeek Harness Desktop Wrapper

English | [中文](README.zh.md)

> **This fork is not an official DeepSeek release.** It preserves the official DeepSeek Harness Web UI and agent runtime, then adds an Electron application shell and native installers. DeepSeek AI does not publish or support the installers in this repository.

Download the unsigned desktop builds from this fork's [GitHub Releases](https://github.com/tppc-linksc/deepseek-harness-NEXA/releases). See the [desktop release notes](apps/desktop/RELEASE_README.md) before installing.

## Upstream project

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

<a id="run-from-source"></a>

### Run the desktop app from source

Install the Node.js and pnpm versions supported by this repository, then run:

```sh
git clone https://github.com/tppc-linksc/deepseek-harness-NEXA.git
cd deepseek-harness-NEXA
pnpm install
pnpm run start:desktop
```

`start:desktop` builds the shared runtime and Web client assets, then opens the Electron desktop window. The process remains attached to the current terminal; press `Ctrl+C` to stop it. The desktop app does not run `dsh web`, open a browser, or bind an HTTP port.

If neither dependencies nor source files have changed, relaunch the built app directly:

```sh
pnpm --filter @deepseek-ai/dsh-desktop start
```

After editing source files, run `pnpm run start:desktop` again so the app is rebuilt before launch. The desktop surface keeps its sessions, settings, credentials, plugins, agent configuration, Chromium state, and logs under its Electron application-data directory; it does not reuse the running Web profile's Harness home.

### Build a desktop installer locally

Run this command from the repository root on the target operating system:

```sh
pnpm run package:desktop:current
```

The resulting DMG, NSIS EXE, or AppImage is written to `dist/installers`. The runtime contains platform-native dependencies, so build each platform's installer on macOS, Windows, or Linux respectively.

### Run the Web UI

To run the upstream Web UI, use the npm package directly:

```sh
npx @deepseek-ai/dsh web
```

Alternatively, build and run it from the current checkout:

```sh
pnpm run build
pnpm dsh web
```

The Web UI listens on `http://127.0.0.1:3080` by default. See the [Web UI guide](docs/user/guide/index.md).

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
