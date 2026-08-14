/** Fetch carrier used by desktop custom protocols, including SSE downlinks. */

import { AbstractApiClient } from './api.ts'

/**
 * Resolve the current standard custom-protocol document as a Fetch base.
 * @returns the current document URL for `dsh:`, otherwise undefined.
 */
export function customProtocolFetchBase(): string | undefined {
  const page = (globalThis as { location?: { href?: string; protocol?: string } }).location
  return page?.protocol === 'dsh:' ? page.href : undefined
}

/** API client whose unary calls and both event streams use global Fetch. */
export class FetchApiClient extends AbstractApiClient {
  protected override resolveBase(): string {
    return customProtocolFetchBase() ?? super.resolveBase()
  }

  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(input, init)
  }
}
