/**
 * dsh-desktop main process — Plan A thin shell.
 *
 * Scope of this milestone: spawn the same `dsh web` host the browser GUI
 * uses, wait for its `dsh web: http://127.0.0.1:<port>` readiness line, open
 * one BrowserWindow at that URL, and stop the host when the app quits. All
 * harness behavior stays in the host process untouched; this file owns only
 * process lifetime, the window, and the macOS menu.
 *
 * The Plan B milestone (dist over a custom protocol + an IPC carrier for the
 * /api RPC and event streams) later replaces the localhost hop; the preload
 * already exposes the `dshDesktop` bridge seam it will grow into.
 */

import { app, BrowserWindow, Menu, shell, dialog, ipcMain, type MenuItemConstructorOptions } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** The dsh host readiness line printed by the web-app bundle once the Loader tree settles. */
const URL_LINE = /^dsh web: (http:\/\/\S+)/
const ANSI = /\x1b\[[0-9;]*m/g

/** Repository root: apps/desktop/{src,lib} are both two levels under it. */
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))

/** The self-contained host tree the packaged app ships as extraResources. */
const PACKAGED_HOST = join(process.resourcesPath, 'host')

/** Window title while the host is still booting. */
const PLACEHOLDER = `<!doctype html><html><meta charset="utf-8"><body style="font-family:-apple-system,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#111;color:#ddd"><div>正在启动 dsh 宿主…<div style="margin-top:8px;font-size:12px;opacity:.6">starting dsh host</div></div></body></html>`

/**
 * The desktop shell's own data home. Kept SEPARATE from the browser GUI's
 * `~/.dsh`: two hosts writing the same session log concurrently corrupt it
 * (observed: 'complete frame contains a torn JSONL record' while testing the
 * desktop build with the browser GUI still running). An explicit
 * `DSH_DESKTOP_HOME` wins; the shell otherwise defaults to a dedicated
 * directory under the user's Library.
 */
function desktopHome(): string {
  return process.env.DSH_DESKTOP_HOME ?? join(homedir(), 'Library', 'Application Support', 'DeepSeek Harness')
}

/**
 * Resolve the host command: `DSH_DESKTOP_HOST` overrides the whole invocation
 * (whitespace-split; no quoting support), `DSH_DESKTOP_CWD` overrides its
 * working directory (relative to the package dir). Defaults to the built dsh
 * CLI in web mode from the repository root.
 */
function hostCommand(): { argv: string[]; cwd: string } {
  const override = process.env.DSH_DESKTOP_HOST
  if (override !== undefined) {
    const cwd = process.env.DSH_DESKTOP_CWD === undefined
      ? process.cwd()
      : fileURLToPath(new URL(process.env.DSH_DESKTOP_CWD, `file://${process.cwd()}/`))
    return { argv: override.split(/\s+/), cwd }
  }
  if (app.isPackaged) {
    // Bundled node runs the deployed CLI, exactly like dev mode's repo CLI.
    return {
      // The deploy root IS the dsh package: its own lib/ holds the CLI.
      // --expose-internals: the HMR service requires it, and the loader's tree
      // write-back can re-enable the (web-disabled) hmr row from the profile dir.
      argv: [join(PACKAGED_HOST, 'node'), '--expose-internals', join(PACKAGED_HOST, 'lib', 'bin.js'), 'web', '--port', '0'],
      cwd: PACKAGED_HOST,
    }
  }
  // `--port 0` asks the OS for a free port: the desktop shell must never
  // collide with an existing `dsh web` (or the harness GUI) on 3080.
  // `--expose-internals` as in the packaged branch.
  return { argv: ['node', '--expose-internals', 'apps/cli/lib/bin.js', 'web', '--port', '0'], cwd: REPO_ROOT }
}

let host: ChildProcess | undefined
let hostUrl: string | undefined
let window: BrowserWindow | undefined
let quitting = false

function loadHostUrl(url: string): void {
  hostUrl = url
  console.log(`[dsh-desktop] host ready: ${url}`)
  if (window !== undefined && !window.isDestroyed()) void window.loadURL(url)
}

/** Spawn the host, pipe its output through, and react to its readiness line. */
function startHost(): void {
  const { argv, cwd } = hostCommand()
  console.log(`[dsh-desktop] spawning host: ${argv.join(' ')} (cwd: ${cwd})`)
  // The host must never share ~/.dsh with a running browser GUI: concurrent
  // writes to one session log corrupt it. Force a dedicated DSH_HOME unless
  // the operator explicitly overrides it.
  const hostEnv: NodeJS.ProcessEnv = { ...process.env }
  if (process.env.DSH_HOME === undefined) hostEnv.DSH_HOME = desktopHome()
  host = spawn(argv[0]!, argv.slice(1), { cwd, env: hostEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  host.on('error', (error) => {
    console.error(`[dsh-desktop] failed to spawn host: ${String(error)}`)
    app.exit(1)
  })
  if (host.stdout === null) throw new Error('dsh-desktop: host stdout pipe unavailable')
  const lines = createInterface({ input: host.stdout })
  lines.on('line', (line) => {
    const clean = line.replace(ANSI, '')
    if (clean.trim() !== '') console.log(clean)
    const match = URL_LINE.exec(clean)
    if (match !== null) loadHostUrl(match[1]!)
  })
  if (host.stderr === null) throw new Error('dsh-desktop: host stderr pipe unavailable')
  host.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk))
  host.on('exit', (code, signal) => {
    console.log(`[dsh-desktop] host exited (code: ${String(code)}, signal: ${String(signal)})`)
    if (!quitting) {
      // The host died on its own before the app asked: nothing left to show.
      app.exit(code === null ? 1 : code)
    }
  })
}

/** Terminate the host: SIGTERM, escalate to SIGKILL after a short grace period. */
async function stopHost(): Promise<void> {
  if (host === undefined || host.exitCode !== null) return
  const child = host
  await new Promise<void>((resolve) => {
    // The child may exit between the null check above and this listener.
    if (child.exitCode !== null) {
      resolve()
      return
    }
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }, 5000)
    child.once('exit', () => clearTimeout(timer))
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'DeepSeek Harness',
    backgroundColor: '#111111',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: fileURLToPath(new URL('../preload.cjs', import.meta.url)),
    },
  })
  win.once('ready-to-show', () => win.show())
  // The window is a host GUI, not a general browser: never leave the host origin.
  win.webContents.on('will-navigate', (event, url) => {
    if (hostUrl !== undefined && !url.startsWith(new URL(hostUrl).origin)) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`[dsh-desktop] load failed (${String(code)}): ${description}`)
  })
  if (process.env.DSH_DESKTOP_SMOKE === '1') {
    // The placeholder data: page also finishes loading; only the host URL counts.
    win.webContents.on('did-finish-load', async () => {
      if (hostUrl === undefined) return
      const url = win.webContents.getURL()
      if (!url.startsWith(new URL(hostUrl).origin)) return
      console.log(`[dsh-desktop smoke] loaded url=${url} title=${win.webContents.getTitle()}`)
      await stopHost()
      app.exit(0)
    })
    // Guard the smoke run against a host that never becomes ready.
    setTimeout(() => {
      if (hostUrl === undefined) {
        console.error('[dsh-desktop smoke] host did not become ready in time')
        app.exit(1)
      }
    }, 60_000)
  }
  return win
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window !== undefined) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  // Native directory dialog for the workspace picker (see preload.cjs):
  // no osascript, no macOS automation permission involved.
  ipcMain.handle('dsh-desktop:pick-directory', async (event) => {
    // Deterministic-pick test hook: DSH_DESKTOP_PICK_PATH returns that path
    // without opening a dialog, letting UI flows be driven end to end.
    const testPath = process.env.DSH_DESKTOP_PICK_PATH
    if (testPath !== undefined) return testPath
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Select Workspace Directory',
      properties: ['openDirectory', 'createDirectory'],
    }
    const result = owner === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(owner, options)
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  app.whenReady().then(() => {
    buildMenu()
    window = createWindow()
    void window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(PLACEHOLDER))
    startHost()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    void stopHost().then(() => app.exit(0))
  })
}
