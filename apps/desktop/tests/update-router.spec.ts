import { describe, expect, it, vi } from 'vitest'
import type { DesktopUpdateState } from '../src/update-contract.ts'
import { handleDesktopUpdateRequest, type DesktopUpdateRouteManager } from '../src/update-router.ts'

function manager(overrides: Partial<DesktopUpdateRouteManager> = {}): DesktopUpdateRouteManager {
  const state: DesktopUpdateState = {
    phase: 'idle',
    currentVersion: '0.1.0-rc.5',
    automaticChecks: true,
  }
  return {
    state: () => state,
    check: vi.fn(async () => {}),
    startDownload: vi.fn(),
    startUpdate: vi.fn(),
    install: vi.fn(async () => {}),
    setAutomaticChecks: vi.fn(async () => {}),
    ...overrides,
  }
}

async function request(path: string, method: string, subject: DesktopUpdateRouteManager, body?: string) {
  const url = new URL(`dsh://app${path}`)
  return handleDesktopUpdateRequest(new Request(url, {
    method,
    ...(body === undefined ? {} : { body, headers: { 'content-type': 'application/json' } }),
  }), url, subject)
}

describe('desktop update private routes', () => {
  it('returns safe state and starts long downloads without waiting', async () => {
    const startDownload = vi.fn()
    const subject = manager({ startDownload })
    const state = await request('/_desktop/update/state', 'GET', subject)
    expect(state?.status).toBe(200)
    expect(await state?.json()).toMatchObject({ phase: 'idle', currentVersion: '0.1.0-rc.5' })
    expect(state?.headers.get('cache-control')).toBe('no-store')

    const download = await request('/_desktop/update/download', 'POST', subject)
    expect(download?.status).toBe(202)
    expect(startDownload).toHaveBeenCalledOnce()

    const startUpdate = vi.fn()
    const update = await request('/_desktop/update/apply', 'POST', manager({ startUpdate }))
    expect(update?.status).toBe(202)
    expect(startUpdate).toHaveBeenCalledOnce()
  })

  it('updates the automatic-check preference from a strict JSON body', async () => {
    const setAutomaticChecks = vi.fn(async () => {})
    const subject = manager({ setAutomaticChecks })
    const response = await request('/_desktop/update/preferences', 'PUT', subject, '{"automaticChecks":false}')
    expect(response?.status).toBe(200)
    expect(setAutomaticChecks).toHaveBeenCalledWith(false)

    const invalid = await request('/_desktop/update/preferences', 'PUT', subject, '{"automaticChecks":false,"extra":true}')
    expect(invalid?.status).toBe(409)
  })

  it('does not claim other routes and rejects methods, queries, and operation failures', async () => {
    const subject = manager({ check: vi.fn(async () => { throw new Error('private diagnostic') }) })
    const other = await request('/api/host.describe', 'GET', subject)
    expect(other).toBeUndefined()
    expect((await request('/_desktop/update/state', 'POST', subject))?.status).toBe(405)
    expect((await request('/_desktop/update/state?redirect=https://example.com', 'GET', subject))?.status).toBe(400)
    const failed = await request('/_desktop/update/check', 'POST', subject)
    expect(failed?.status).toBe(409)
    expect(await failed?.json()).toEqual({ error: '更新操作暂时无法完成。' })
  })
})
