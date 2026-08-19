/** In-memory WebServer-compatible route carrier for the desktop custom protocol. */

import type { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { Context, Service } from '@deepseek-ai/cordis'
import type { WebRoute, WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import { DESKTOP_ORIGIN } from './protocol.ts'

const DESKTOP_LOOPBACK_HOST = '127.0.0.1'
const DESKTOP_LOOPBACK_ORIGIN = `http://${DESKTOP_LOOPBACK_HOST}`

/** Desktop WebServer surface that never binds a TCP socket. */
export class PortlessWebServer extends Service {
  private readonly exact = new Map<string, WebRoute>()
  private readonly prefixes = new Map<string, WebRoute>()
  private readonly indexTaps: ((html: string) => string)[] = []
  private fallback: WebRoute['handler'] | undefined

  constructor(ctx: Context) {
    super(ctx, 'webServer')
  }

  /** Compatibility host literal; no socket is created. */
  get host(): '127.0.0.1' {
    return '127.0.0.1'
  }

  /** Compatibility port literal; zero means no listening endpoint exists. */
  get port(): 0 {
    return 0
  }

  /**
   * Register an exact or prefix route.
   * @param route - named route handled inside the UtilityProcess.
   * @returns disposer removing the route.
   */
  register(route: WebRoute): () => void {
    const table = route.kind === 'exact' ? this.exact : this.prefixes
    if (table.has(route.path)) {
      throw new Error(`desktop-app: duplicate ${route.kind} route ${JSON.stringify(route.path)}`)
    }
    table.set(route.path, route)
    return () => { table.delete(route.path) }
  }

  /**
   * Desktop custom-protocol requests cannot upgrade to raw sockets.
   * @param _route - unsupported upgrade route.
   * @returns never.
   */
  registerUpgrade(_route: WebUpgradeRoute): () => void {
    throw new Error('desktop-app: custom-protocol routes do not support socket upgrades')
  }

  /**
   * Claim the optional unmatched-request handler.
   * @param handler - fallback response owner.
   * @returns disposer releasing the fallback.
   */
  registerFallback(handler: WebRoute['handler']): () => void {
    if (this.fallback !== undefined) throw new Error('desktop-app: fallback route already registered')
    this.fallback = handler
    return () => { this.fallback = undefined }
  }

  /**
   * Register an index transform for WebServer API compatibility.
   * @param transform - index transformation.
   * @returns disposer removing the transformation.
   */
  tapIndex(transform: (html: string) => string): () => void {
    this.indexTaps.push(transform)
    return () => {
      const at = this.indexTaps.indexOf(transform)
      if (at !== -1) this.indexTaps.splice(at, 1)
    }
  }

  /**
   * Apply registered index transformations in order.
   * @param html - input index document.
   * @returns transformed document.
   */
  applyIndexTaps(html: string): string {
    return this.indexTaps.reduce((current, transform) => transform(current), html)
  }

  /**
   * Dispatch one Fetch request through registered Node-style WebServer routes.
   * @param request - custom-protocol request received from Electron main.
   * @param onUnmatched - optional logical-carrier fallback after no WebServer route claims the path.
   * @returns captured Fetch response.
   */
  async fetch(request: Request, onUnmatched?: () => Promise<Response>): Promise<Response> {
    const url = new URL(request.url)
    const route = this.match(url.pathname)
    const handler = route?.handler ?? this.fallback
    if (handler === undefined) {
      return onUnmatched === undefined
        ? new Response('not found', { status: 404 })
        : onUnmatched()
    }

    const body = request.body === null ? undefined : new Uint8Array(await request.arrayBuffer())
    const incoming = desktopIncomingMessage(request, url, body)
    const captured = new CapturedServerResponse(request.method !== 'HEAD')
    const abort = (): void => {
      Object.assign(incoming, { aborted: true })
      incoming.emit('aborted')
      incoming.destroy()
      captured.destroy(new DOMException('The operation was aborted', 'AbortError'))
    }
    request.signal.addEventListener('abort', abort, { once: true })
    captured.once('close', () => { request.signal.removeEventListener('abort', abort) })
    void Promise.resolve().then(async () => {
      await handler(incoming, captured.nodeResponse)
      captured.handlerCompleted(url.pathname)
    }).catch((error: unknown) => {
      captured.destroy(error instanceof Error ? error : new Error(String(error)))
    })
    return captured.response
  }

  private match(pathname: string): WebRoute | undefined {
    const exact = this.exact.get(pathname)
    if (exact !== undefined) return exact
    let best: WebRoute | undefined
    for (const [prefix, route] of this.prefixes) {
      if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue
      if (best === undefined || prefix.length > best.path.length) best = route
    }
    return best
  }
}

/** Convert Fetch headers to the loopback HTTP representation expected by Node routes. */
function desktopHeaders(request: Request): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = {}
  for (const [name, value] of request.headers) headers[name] = value
  headers.host = DESKTOP_LOOPBACK_HOST
  // Electron main has already validated the private desktop authority. Present
  // that authority as loopback HTTP for ordinary Node route guards while leaving
  // an explicit foreign Origin intact for route-owned CSRF rejection.
  if (headers.origin === undefined || headers.origin === DESKTOP_ORIGIN) {
    headers.origin = DESKTOP_LOOPBACK_ORIGIN
  }
  return headers
}

/** Build the structural IncomingMessage subset used by desktop market routes. */
function desktopIncomingMessage(request: Request, url: URL, body: Uint8Array | undefined): IncomingMessage {
  const readable = body === undefined ? Readable.from([]) : Readable.from([Buffer.from(body)])
  return Object.assign(readable, {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: desktopHeaders(request),
    socket: { remoteAddress: DESKTOP_LOOPBACK_HOST },
  }) as unknown as IncomingMessage
}

/** Streams the common ServerResponse surface used by extension HTTP and SSE routes. */
class CapturedServerResponse extends EventEmitter {
  private readonly headers = new Map<string, string>()
  private readonly stream: ReadableStream<Uint8Array>
  private controller!: ReadableStreamDefaultController<Uint8Array>
  private resolveResponse!: (response: Response) => void
  private rejectResponse!: (error: Error) => void
  private ended = false
  private committed = false
  private closed = false
  private waitingForDrain = false
  private status = 200
  readonly response: Promise<Response>
  readonly nodeResponse: ServerResponse

  constructor(private readonly bodyAllowed: boolean) {
    super()
    this.response = new Promise<Response>((resolve, reject) => {
      this.resolveResponse = resolve
      this.rejectResponse = reject
    })
    this.stream = new ReadableStream<Uint8Array>({
      start: (controller) => { this.controller = controller },
      pull: () => {
        if (!this.waitingForDrain) return
        this.waitingForDrain = false
        queueMicrotask(() => { this.emit('drain') })
      },
      cancel: () => { this.close() },
    })
    this.nodeResponse = this as unknown as ServerResponse
  }

  /** Whether the response head has crossed into the Fetch response. */
  get headersSent(): boolean {
    return this.committed
  }

  /** HTTP status used when the head is committed. */
  get statusCode(): number {
    return this.status
  }

  set statusCode(value: number) {
    this.assertMutableHead()
    this.status = value
  }

  /** Whether `end()` or `destroy()` has closed the route response. */
  get writableEnded(): boolean {
    return this.ended
  }

  /** Whether the route response has completed writing. */
  get writableFinished(): boolean {
    return this.ended
  }

  /** Commit a response head and optional headers. */
  writeHead(
    status: number,
    statusMessageOrHeaders?: string | OutgoingHttpHeaders,
    headers?: OutgoingHttpHeaders,
  ): this {
    this.assertMutableHead()
    this.status = status
    this.mergeHeaders(typeof statusMessageOrHeaders === 'string' ? headers : statusMessageOrHeaders)
    this.commit()
    return this
  }

  /** Set one response header before the head is committed. */
  setHeader(name: string, value: number | string | readonly string[]): this {
    this.assertMutableHead()
    this.headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value))
    return this
  }

  /** Read one pending or committed response header. */
  getHeader(name: string): string | undefined {
    return this.headers.get(name.toLowerCase())
  }

  /** Read all response headers as a plain record. */
  getHeaders(): OutgoingHttpHeaders {
    return Object.fromEntries(this.headers)
  }

  /** Test whether one response header exists. */
  hasHeader(name: string): boolean {
    return this.headers.has(name.toLowerCase())
  }

  /** Remove one response header before the head is committed. */
  removeHeader(name: string): void {
    this.assertMutableHead()
    this.headers.delete(name.toLowerCase())
  }

  /** Commit response headers without writing a body chunk. */
  flushHeaders(): void {
    this.commit()
  }

  /** Write one response body chunk. */
  write(chunk: unknown, encodingOrCallback?: BufferEncoding | (() => void), callback?: () => void): boolean {
    if (this.ended) throw new Error('desktop-app: cannot write after the route response ended')
    this.commit()
    if (this.hasResponseBody()) {
      this.controller.enqueue(responseChunk(chunk, typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined))
    }
    const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
    done?.()
    const writable = !this.hasResponseBody() || (this.controller.desiredSize ?? 1) > 0
    this.waitingForDrain ||= !writable
    return writable
  }

  /** End the response, optionally with one final body chunk. */
  end(chunk?: unknown, encodingOrCallback?: BufferEncoding | (() => void), callback?: () => void): this {
    if (this.ended) return this
    if (chunk !== undefined) this.write(chunk, encodingOrCallback, callback)
    else {
      this.commit()
      const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
      done?.()
    }
    this.ended = true
    if (this.hasResponseBody()) this.controller.close()
    this.emit('finish')
    this.close()
    return this
  }

  /** Terminate an open route response and notify stream consumers. */
  destroy(error?: Error): this {
    if (this.closed) return this
    this.ended = true
    if (!this.committed) {
      this.rejectResponse(error ?? new Error('desktop-app: route response was destroyed'))
    } else if (this.hasResponseBody()) {
      if (error === undefined) this.controller.close()
      else this.controller.error(error)
    }
    if (error !== undefined && this.listenerCount('error') > 0) this.emit('error', error)
    this.close()
    return this
  }

  /** Fail a handler that returned before producing any response head. */
  handlerCompleted(pathname: string): void {
    if (this.committed || this.closed) return
    this.destroy(new Error(`desktop-app: route ${JSON.stringify(pathname)} returned without starting its response`))
  }

  private mergeHeaders(headers: OutgoingHttpHeaders | undefined): void {
    if (headers === undefined) return
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue
      this.headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value))
    }
  }

  private assertMutableHead(): void {
    if (this.committed) throw new Error('desktop-app: route response headers were already sent')
  }

  private hasResponseBody(): boolean {
    return this.bodyAllowed && ![204, 205, 304].includes(this.status)
  }

  private commit(): void {
    if (this.committed) return
    const response = new Response(this.hasResponseBody() ? this.stream : null, {
      status: this.status,
      headers: Object.fromEntries(this.headers),
    })
    this.committed = true
    this.resolveResponse(response)
  }

  private close(): void {
    if (this.closed) return
    this.closed = true
    this.emit('close')
  }
}

/** Normalize one Node response chunk to bytes. */
function responseChunk(chunk: unknown, encoding?: BufferEncoding): Uint8Array {
  if (typeof chunk === 'string') return Buffer.from(chunk, encoding)
  if (chunk instanceof Uint8Array) return chunk
  throw new TypeError('desktop-app: route response chunks must be strings or byte arrays')
}
