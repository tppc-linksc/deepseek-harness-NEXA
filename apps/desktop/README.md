# @deepseek-ai/dsh-desktop

macOS desktop shell for the dsh web GUI — **Plan A thin wrapper** (milestone 1 of 2).

The whole harness stays untouched: this app spawns the same `dsh web` host the
browser GUI uses, waits for its `dsh web: http://127.0.0.1:<port>` readiness
line, and opens one Electron window at that URL. Closing the window stops the
host.

## Run

Prerequisites (one time):

```sh
pnpm install
pnpm run build          # host libs + web frontend dist (required by dsh web)
```

Start the desktop shell:

```sh
pnpm dev:desktop
```

Smoke run (no harness build needed — uses `scripts/fake-host.mjs` and quits
itself after the page loads):

```sh
pnpm smoke:desktop
```

## How it works

- `src/main.ts` — Electron main: spawns the host (`node apps/cli/lib/bin.js web`
  from the repo root; override with `DSH_DESKTOP_HOST`, working dir with
  `DSH_DESKTOP_CWD`), parses the readiness line, loads the URL, kills the host
  on quit (SIGTERM, then SIGKILL after 5 s), and guards navigation to the host
  origin only.
- `preload.cjs` — seam stub exposing `window.dshDesktop` (platform +
  versions). **Plan B** (dist over a custom protocol + an IPC carrier for the
  /api RPC and event streams) grows this into the full bridge; the renderer's
  connection layer already abstracts the carrier, so no shell code changes.
- `scripts/fake-host.mjs` — dev-only stand-in for `dsh web`, used by the
  smoke run.

## Current scope vs Plan B

| | Plan A (this milestone) | Plan B (next) |
|---|---|---|
| Transport | localhost HTTP/WS (unchanged) | `file://`/custom protocol + IPC carrier |
| Host process | spawned `dsh web` child | same host graph, in-process or bundled binary |
| Packaging | none yet | .app/.dmg, signing, notarization |
| Existing code touched | none | carrier selection only |
## Troubleshooting

- **`Electron failed to install correctly` on Node ≥ 26** — the electron
  postinstall (extract-zip@2.0.1) partially extracts the binary on Node 26.
  Until upstream fixes it, lay the binary down manually once:

  ```sh
  cd node_modules/.pnpm/electron@40.9.3/node_modules/electron
  rm -rf dist && mkdir dist
  unzip -qo ~/Library/Caches/electron/electron-v40.9.3-darwin-arm64.zip -d dist
  printf 'Electron.app/Contents/MacOS/Electron' > path.txt
  ```

  (Adjust the version in the paths if it was bumped.)

## Packaging

```sh
pnpm pack:desktop            # .app + .dmg into apps/desktop/dist/
pnpm pack:desktop --dir      # alias of pack:dir inside the package
```

Or from the package dir: `npm run pack` (also builds the dmg) and `npm run pack:dir`
(unpacked .app only). The pipeline:

1. `tsc` builds the shell (`lib/`).
2. `scripts/package-host.mjs` deploys the dsh CLI closure into `host/`:
   - `pnpm deploy --legacy` (outside-link repair + peer/bootstrap materialization
     are handled inside the script — see its header for the pnpm quirks it
     works around),
   - a self-contained node binary is copied in as `host/node`,
   - the host is booted once to materialize whatever deploy dropped.
3. `electron-builder --dir` packs the app shell (the host is too large and too
   symlink-heavy for electron-builder's own copy — see `scripts/finish-app.mjs`).
4. `scripts/finish-app.mjs` injects `host/` into
   `Contents/Resources/host` and optionally builds the dmg with `hdiutil`.

Signing: local builds are ad-hoc (no identity). For distribution set
`CSC_LINK`/`CSC_KEY_PASSWORD` (or `mac.identity`) in electron-builder.yml
and remove `identity: null`.

Requires a prior `pnpm run build` (host libs + web frontend dist).
