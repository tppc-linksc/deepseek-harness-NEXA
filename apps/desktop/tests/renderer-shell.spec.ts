import { describe, expect, it } from 'vitest'
import { isRendererShellPath, rendererSecurityHeaders } from '../src/renderer-shell.ts'

describe('desktop renderer shell', () => {
  it.each([
    '/',
    '/index.html',
    '/assets/index.js',
    '/assets/fonts/font.woff2',
    '/favicon.svg',
    '/manifest.webmanifest',
  ])('serves %s from the bundled Web frontend', (pathname) => {
    expect(isRendererShellPath(pathname)).toBe(true)
  })

  it.each(['/api/session', '/plugins/example/client.js', '/events'])('forwards %s to the Host', (pathname) => {
    expect(isRendererShellPath(pathname)).toBe(false)
  })

  it('allows the client-plugin evaluator without exposing remote script origins', () => {
    const headers = rendererSecurityHeaders('text/javascript')
    expect(headers.get('content-type')).toBe('text/javascript')
    expect(headers.get('content-security-policy')).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    expect(headers.get('content-security-policy')).not.toContain('script-src *')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
  })
})
