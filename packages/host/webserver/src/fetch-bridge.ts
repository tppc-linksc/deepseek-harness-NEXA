/** node:http to WHATWG Fetch bridge shared by browser transport adapters. */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** Default per-request resident bound, including aggregate base64 image payloads. */
export const DEFAULT_MAX_REQUEST_BODY_BYTES = 160 * 1024 * 1024

/** Fetch-shaped target consumed by the browser HTTP bridge. */
export interface FetchHandler {
  /**
   * Handle one transport-produced request.
   * @param request - standard Fetch request.
   * @returns complete or streaming Fetch response.
   */
  fetch(request: Request): Promise<Response>
}

/**
 * Bridge one node:http request to a Fetch-shaped handler.
 * @param req - incoming request, buffered before dispatch.
 * @param res - outgoing response, streamed with socket backpressure.
 * @param handler - Fetch-shaped logical dispatcher.
 * @param maxRequestBodyBytes - maximum buffered request body.
 */
export async function bridgeFetch(
  req: IncomingMessage,
  res: ServerResponse,
  handler: FetchHandler,
  maxRequestBodyBytes = DEFAULT_MAX_REQUEST_BODY_BYTES,
): Promise<void> {
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })
  const declaredLength = req.headers['content-length']
  if (declaredLength !== undefined && Number(declaredLength) > maxRequestBodyBytes) {
    res.writeHead(413, { connection: 'close' })
    res.end()
    req.destroy()
    return
  }
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    received += buffer.byteLength
    if (received > maxRequestBodyBytes) {
      res.writeHead(413, { connection: 'close' })
      res.end()
      req.destroy()
      return
    }
    chunks.push(buffer)
  }
  /* v8 ignore next 3 -- node:http always supplies url and method. */
  const request = new Request(new URL(req.url ?? '/', 'http://dsh.internal'), {
    method: req.method ?? 'GET',
    headers: Object.fromEntries(Object.entries(req.headers).filter(([, value]) => typeof value === 'string') as [string, string][]),
    ...chunks.length > 0 ? { body: Buffer.concat(chunks) } : {},
    signal: abort.signal,
  })
  const response = await handler.fetch(request)
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  if (response.body === null) {
    res.end()
    return
  }
  for await (const chunk of response.body) {
    if (!res.write(chunk)) {
      await new Promise<void>((resolveDrain) => {
        const done = (): void => {
          res.off('drain', done)
          res.off('close', done)
          resolveDrain()
        }
        res.once('drain', done)
        res.once('close', done)
      })
    }
  }
  res.end()
}
