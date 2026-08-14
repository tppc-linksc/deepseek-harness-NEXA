/** Static renderer-shell routing and response security headers. */

const PUBLIC_SHELL_PATHS = new Set(['/favicon.svg', '/manifest.webmanifest'])

/**
 * Test whether a desktop URL belongs to the bundled Web renderer shell.
 * @param pathname - URL pathname; bundled asset names contain no percent escapes.
 * @returns Whether Electron main must serve the path from the Web frontend dist.
 */
export function isRendererShellPath(pathname: string): boolean {
  return pathname === '/'
    || pathname === '/index.html'
    || pathname.startsWith('/assets/')
    || PUBLIC_SHELL_PATHS.has(pathname)
}

/**
 * Build security headers for one bundled renderer resource.
 * @param contentType - MIME type of the response body.
 * @returns Headers applied to the custom-protocol response.
 */
export function rendererSecurityHeaders(contentType: string): Headers {
  return new Headers({
    'content-type': contentType,
    // The client-plugin runner evaluates Host-supplied client bundles with
    // new Function. Renderer sandboxing, not CSP, withholds Node privileges.
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'",
    'x-content-type-options': 'nosniff',
  })
}
