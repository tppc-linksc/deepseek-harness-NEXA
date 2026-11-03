/**
 * dsh-desktop smoke host — NOT part of the product.
 *
 * A minimal stand-in for `dsh web` used by the smoke run: binds an
 * OS-assigned loopback port, prints the exact `dsh web: http://…` readiness
 * line the shell parses, and serves one static page so the smoke run can
 * observe a completed load. The real host (apps/cli + the web profile) is
 * reached through the same code path in `pnpm dev:desktop`.
 */
import { createServer } from 'node:http'

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(
    '<!doctype html><html><meta charset="utf-8"><body>'
    + '<h1>dsh fake host</h1>'
    + '<p>Plan A shell smoke page. The real host is served by <code>dsh web</code>.</p>'
    + '</body></html>',
  )
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fake host: no TCP port')
  console.log(`dsh web: http://127.0.0.1:${address.port}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
