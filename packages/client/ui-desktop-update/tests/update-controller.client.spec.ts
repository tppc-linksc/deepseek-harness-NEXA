// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  DesktopUpdateController, parseDesktopUpdateState,
} from '../src/client/update-controller.ts'

const IDLE_STATE = {
  phase: 'idle',
  currentVersion: '0.1.0-rc.6',
  automaticChecks: true,
} as const

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('desktop update response validation', () => {
  it('accepts the renderer-safe update fields', () => {
    expect(parseDesktopUpdateState({
      phase: 'available',
      currentVersion: '0.1.0-rc.6',
      automaticChecks: true,
      availableVersion: '0.1.0-rc.7',
      upstreamVersion: '0.1.0-rc.7',
      releaseNotesUrl: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/nexa-v0.1.0-rc.7',
      downloadedBytes: 0,
      totalBytes: 128,
      lastCheckedAt: '2026-08-18T00:00:00.000Z',
    })).toMatchObject({ phase: 'available', availableVersion: '0.1.0-rc.7' })
  })

  it.each([
    null,
    { ...IDLE_STATE, phase: 'pending' },
    { ...IDLE_STATE, localInstallerPath: '/tmp/private.dmg' },
    { ...IDLE_STATE, releaseNotesUrl: 'https://example.com/release' },
    { ...IDLE_STATE, downloadedBytes: -1 },
  ])('rejects invalid or private fields: %j', (value) => {
    expect(() => parseDesktopUpdateState(value)).toThrow()
  })
})

describe('DesktopUpdateController', () => {
  it('loads and checks through the private desktop routes', async () => {
    const available = {
      ...IDLE_STATE,
      phase: 'available',
      availableVersion: '0.1.0-rc.7',
    } as const
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(IDLE_STATE))
      .mockResolvedValueOnce(response(available))
    const controller = new DesktopUpdateController(fetcher)

    await controller.load()
    expect(fetcher).toHaveBeenNthCalledWith(1, '/_desktop/update/state', {
      method: 'GET',
      cache: 'no-store',
    })
    await controller.check()
    expect(fetcher).toHaveBeenNthCalledWith(2, '/_desktop/update/check', {
      method: 'POST',
      cache: 'no-store',
    })
    expect(controller.store.getSnapshot()).toEqual(available)
  })

  it('persists automatic-check preferences as JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      ...IDLE_STATE,
      automaticChecks: false,
    }))
    const controller = new DesktopUpdateController(fetcher)

    await controller.setAutomaticChecks(false)

    expect(fetcher).toHaveBeenCalledWith('/_desktop/update/preferences', {
      method: 'PUT',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ automaticChecks: false }),
    })
    expect(controller.store.getSnapshot().automaticChecks).toBe(false)
  })

  it('starts download and installer opening as one update action', async () => {
    const downloading = {
      ...IDLE_STATE,
      phase: 'downloading',
      availableVersion: '0.1.0-rc.7',
      downloadedBytes: 32,
      totalBytes: 128,
    } as const
    const fetcher = vi.fn().mockResolvedValue(response(downloading))
    const controller = new DesktopUpdateController(fetcher)

    await controller.update()

    expect(fetcher).toHaveBeenCalledWith('/_desktop/update/apply', {
      method: 'POST',
      cache: 'no-store',
    })
    expect(controller.store.getSnapshot()).toEqual(downloading)
  })

  it('publishes a safe server error and ignores disposed responses', async () => {
    const failure = new DesktopUpdateController(
      vi.fn().mockResolvedValue(response({ error: 'manifest unavailable' }, 502)),
    )
    await failure.check()
    expect(failure.store.getSnapshot()).toMatchObject({
      phase: 'error',
      error: 'manifest unavailable',
    })

    let resolveResponse!: (value: Response) => void
    const pending = new Promise<Response>((resolve) => { resolveResponse = resolve })
    const disposed = new DesktopUpdateController(vi.fn().mockReturnValue(pending))
    const load = disposed.load()
    disposed.dispose()
    resolveResponse(response({ ...IDLE_STATE, phase: 'up-to-date' }))
    await load
    expect(disposed.store.getSnapshot()).toEqual({
      phase: 'idle',
      currentVersion: '…',
      automaticChecks: true,
    })
  })
})
