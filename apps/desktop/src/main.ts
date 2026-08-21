/** Electron main process for the portless DeepSeek Harness desktop application. */

import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, BrowserWindow, dialog, net, protocol, shell, utilityProcess, type UtilityProcess } from 'electron'
import { injectBootManifest, type WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import {
  DESKTOP_MAX_REQUEST_BODY_BYTES,
  DESKTOP_ORIGIN,
  DESKTOP_SCHEME,
  isDesktopUrl,
  parseDesktopHostMessage,
  type DesktopHostMessage,
  type DesktopMainMessage,
} from '@deepseek-ai/dsh-desktop-app/protocol'
import { desktopHostEnvironment, resolveDesktopPaths } from './paths.ts'
import { isRendererShellPath, rendererSecurityHeaders } from './renderer-shell.ts'
import { DesktopUpdateManager } from './update-manager.ts'
import { handleDesktopUpdateRequest } from './update-router.ts'
import { resolveBundledPnpmBin } from './bundled-tools.ts'
import { desktopHostFailureAction, desktopHostFailureDialog } from './host-failure.ts'

protocol.registerSchemesAsPrivileged([{
  scheme: DESKTOP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    codeCache: true,
  },
}])

app.setName('DeepSeek Harness')
const desktopPaths = resolveDesktopPaths(app.getPath('appData'))
app.setPath('userData', desktopPaths.userData)

const require = createRequire(import.meta.url)
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

interface PendingRequest {
  readonly resolve: (value: { status: number; headers: [string, string][] }) => void
  readonly reject: (error: Error) => void
  controller?: ReadableStreamDefaultController<Uint8Array>
  pullOutstanding: boolean
  settled: boolean
  ended: boolean
}

class DesktopHost {
  private readonly pending = new Map<string, PendingRequest>()
  private graph: WebBootGraph | undefined
  private failure: Error | undefined
  private closing = false
  private readyResolve!: (graph: WebBootGraph) => void
  private readyReject!: (error: Error) => void
  readonly ready = new Promise<WebBootGraph>((resolveReady, rejectReady) => {
    this.readyResolve = resolveReady
    this.readyReject = rejectReady
  })

  constructor(
    private readonly child: UtilityProcess,
    private readonly onGraphChanged: (graph: WebBootGraph) => void,
    private readonly onFatal: (error: Error) => void,
  ) {
    child.on('message', (value) => { this.receive(value) })
    child.on('exit', (code) => {
      if (this.closing) return
      this.failHost(new Error(`desktop Host process exited with code ${String(code)}`), false)
    })
    child.on('error', (error) => { this.failHost(new Error(error), false) })
  }

  currentGraph(): WebBootGraph | undefined {
    return this.graph
  }

  async fetch(request: Request): Promise<Response> {
    if (this.failure !== undefined) throw this.failure
    const id = randomUUID()
    const body = request.body === null ? undefined : new Uint8Array(await request.arrayBuffer())
    if (body !== undefined && body.byteLength > DESKTOP_MAX_REQUEST_BODY_BYTES) {
      return new Response('request body too large', { status: 413 })
    }
    let resolveHead!: PendingRequest['resolve']
    let rejectHead!: PendingRequest['reject']
    const head = new Promise<{ status: number; headers: [string, string][] }>((resolve, reject) => {
      resolveHead = resolve
      rejectHead = reject
    })
    const pending: PendingRequest = {
      resolve: resolveHead,
      reject: rejectHead,
      pullOutstanding: false,
      settled: false,
      ended: false,
    }
    this.pending.set(id, pending)
    const cancel = (): void => {
      if (!this.pending.delete(id)) return
      this.post({ type: 'cancel', id })
      this.fail(pending, new DOMException('The operation was aborted', 'AbortError'))
    }
    request.signal.addEventListener('abort', cancel, { once: true })
    this.post({
      type: 'request',
      id,
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      ...(body === undefined ? {} : { body }),
    })
    try {
      const response = await head
      const bodyless = request.method === 'HEAD' || [101, 204, 205, 304].includes(response.status)
      if (bodyless) {
        cancel()
        return new Response(null, response)
      }
      const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
          if (pending.ended) controller.close()
          else pending.controller = controller
        },
        pull: () => {
          if (pending.pullOutstanding || !this.pending.has(id)) return
          pending.pullOutstanding = true
          this.post({ type: 'pull', id })
        },
        cancel,
      })
      return new Response(stream, response)
    } catch (error) {
      cancel()
      throw error
    } finally {
      request.signal.removeEventListener('abort', cancel)
    }
  }

  close(): void {
    if (this.closing) return
    this.closing = true
    for (const [id, request] of this.pending) {
      this.post({ type: 'cancel', id })
      this.fail(request, new Error('desktop Host process is shutting down'))
    }
    this.pending.clear()
    this.child.kill()
  }

  private receive(value: unknown): void {
    if (this.failure !== undefined || this.closing) return
    let message: DesktopHostMessage
    try {
      message = parseDesktopHostMessage(value)
    } catch (error) {
      this.failHost(error instanceof Error ? error : new Error(String(error)))
      return
    }
    if (message.type === 'ready') {
      const changed = this.graph !== undefined && this.graph.rev !== message.graph.rev
      this.graph = message.graph
      this.readyResolve(message.graph)
      if (changed) this.onGraphChanged(message.graph)
      return
    }
    if (message.type === 'error' && message.id === undefined) {
      this.failHost(new Error(message.message))
      return
    }
    const id = message.id
    if (id === undefined) return
    const pending = this.pending.get(id)
    if (pending === undefined) return
    if (message.type === 'response') {
      if (pending.settled) return
      pending.settled = true
      pending.resolve({ status: message.status, headers: message.headers })
      return
    }
    if (message.type === 'chunk') {
      pending.pullOutstanding = false
      pending.controller?.enqueue(message.chunk)
      return
    }
    if (message.type === 'end') {
      this.pending.delete(message.id)
      pending.ended = true
      pending.controller?.close()
      return
    }
    this.pending.delete(id)
    this.fail(pending, new Error(message.message))
  }

  private fail(request: PendingRequest, error: Error): void {
    if (!request.settled) {
      request.settled = true
      request.reject(error)
    } else {
      request.controller?.error(error)
    }
  }

  private failHost(error: Error, terminate = true): void {
    if (this.failure !== undefined || this.closing) return
    this.failure = error
    this.readyReject(error)
    for (const request of this.pending.values()) this.fail(request, error)
    this.pending.clear()
    if (terminate) this.child.kill()
    this.onFatal(error)
  }

  private post(message: DesktopMainMessage): void {
    this.child.postMessage(message)
  }
}

let mainWindow: BrowserWindow | undefined
let host: DesktopHost | undefined
let updateManager: DesktopUpdateManager | undefined
let hostFailurePrompt: Promise<void> | undefined

function reportHostFailure(error: unknown): Promise<void> {
  hostFailurePrompt ??= (async () => {
    console.error(error)
    mainWindow?.destroy()
    const locations = {
      profileDirectory: desktopPaths.profile,
      logFile: join(desktopPaths.logs, 'host.log'),
    }
    try {
      const choice = await dialog.showMessageBox(
        desktopHostFailureDialog(error, locations, app.getLocale()),
      )
      const action = desktopHostFailureAction(choice.response, locations)
      if (action.kind === 'open') {
        const openError = await shell.openPath(action.path)
        if (openError !== '') console.error(`could not open desktop recovery path: ${openError}`)
      }
    } catch (dialogError) {
      console.error('desktop startup failure dialog failed', dialogError)
    } finally {
      app.exit(1)
    }
  })()
  return hostFailurePrompt
}

function resolveFrontend(): { index: string; root: string } {
  const index = require.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html')
  return { index, root: dirname(index) }
}

function resolveCliBin(): string {
  return join(dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'lib', 'bin.js')
}

async function staticResponse(frontend: { index: string; root: string }, pathname: string, graph: WebBootGraph): Promise<Response> {
  if (pathname === '/' || pathname === '/index.html') {
    const html = injectBootManifest(await readFile(frontend.index, 'utf8'), graph)
    return new Response(html, { headers: rendererSecurityHeaders('text/html; charset=utf-8') })
  }
  const path = resolve(frontend.root, `.${pathname}`)
  const inside = relative(frontend.root, path)
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return new Response('not found', { status: 404 })
  try {
    const body = await readFile(path)
    return new Response(body, { headers: rendererSecurityHeaders(CONTENT_TYPES[extname(path)] ?? 'application/octet-stream') })
  } catch {
    return new Response('not found', { status: 404 })
  }
}

async function startHost(): Promise<DesktopHost> {
  await Promise.all([
    mkdir(desktopPaths.runtime, { recursive: true }),
    mkdir(desktopPaths.agents, { recursive: true }),
    mkdir(desktopPaths.logs, { recursive: true }),
    mkdir(desktopPaths.profile, { recursive: true }),
    mkdir(desktopPaths.commandRuntime, { recursive: true }),
  ])
  const dshBin = resolveCliBin()
  const child = utilityProcess.fork(dshBin, ['--profile', 'desktop'], {
    env: desktopHostEnvironment(process.env, desktopPaths, {
      appExecutable: process.execPath,
      dshBin,
      pnpmBin: resolveBundledPnpmBin(),
      electronVersion: process.versions.electron,
    }),
    // Source launches need the Loader's internal resolver to honor the profile
    // module base. Electron strips this internal-only flag from packaged apps,
    // whose deployment instead provides a complete hoisted dependency closure.
    execArgv: ['--expose-internals'],
    stdio: 'pipe',
    serviceName: 'DeepSeek Harness Host',
  })
  const log = createWriteStream(join(desktopPaths.logs, 'host.log'), { flags: 'a' })
  log.write(`[${new Date().toISOString()}] desktop Host starting\n`)
  child.stdout?.on('data', (chunk: Buffer) => { log.write(chunk) })
  child.stderr?.on('data', (chunk: Buffer) => { log.write(chunk) })
  child.on('exit', (code) => {
    log.end(`[${new Date().toISOString()}] desktop Host exited with code ${String(code)}\n`)
  })
  return new DesktopHost(
    child,
    () => { mainWindow?.webContents.reload() },
    (error) => {
      void reportHostFailure(error)
    },
  )
}

async function createWindow(): Promise<void> {
  const desktopHost = host ??= await startHost()
  const desktopUpdates = updateManager ??= await startUpdateManager()
  const frontend = resolveFrontend()
  await desktopHost.ready
  if (!protocol.isProtocolHandled(DESKTOP_SCHEME)) {
    protocol.handle(DESKTOP_SCHEME, async (request) => {
      const url = new URL(request.url)
      if (!isDesktopUrl(url)) return new Response('not found', { status: 404 })
      const updateResponse = await handleDesktopUpdateRequest(request, url, desktopUpdates)
      if (updateResponse !== undefined) return updateResponse
      const graph = desktopHost.currentGraph()
      if (graph === undefined) return new Response('desktop Host is starting', { status: 503 })
      if (isRendererShellPath(url.pathname)) {
        let pathname: string
        try {
          pathname = decodeURIComponent(url.pathname)
        } catch {
          return new Response('invalid path', { status: 400 })
        }
        return staticResponse(frontend, pathname, graph)
      }
      return desktopHost.fetch(request)
    })
  }
  mainWindow = new BrowserWindow({
    title: 'DeepSeek Harness',
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  mainWindow.once('ready-to-show', () => { mainWindow?.show() })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isDesktopUrl(url)) event.preventDefault()
  })
  mainWindow.on('closed', () => { mainWindow = undefined })
  if (desktopUpdates.shouldAutomaticallyCheck()) {
    void desktopUpdates.check().catch((error: unknown) => {
      console.error('automatic desktop update check failed', error)
    })
  }
  await mainWindow.loadURL(`${DESKTOP_ORIGIN}/`)
}

async function startUpdateManager(): Promise<DesktopUpdateManager> {
  const manager = new DesktopUpdateManager({
    currentVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    storageDirectory: desktopPaths.updates,
    fetch: async (input, init) => net.fetch(input, init),
    openPath: async path => shell.openPath(path),
    quit: () => { app.quit() },
  })
  await manager.initialize()
  return manager
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) void createWindow()
    else {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.on('before-quit', () => {
    host?.close()
    host = undefined
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('activate', () => {
    if (mainWindow === undefined) void createWindow()
  })
  void app.whenReady().then(createWindow).catch((error: unknown) => {
    void reportHostFailure(error)
  })
}
