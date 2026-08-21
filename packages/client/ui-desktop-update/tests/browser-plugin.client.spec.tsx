// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSnapshotStore, SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { DesktopUpdateRow } from '../src/client/DesktopUpdateRow.tsx'
import type { DesktopUpdateRowInjected, DesktopUpdateRowProps } from '../src/client/DesktopUpdateRow.tsx'
import { DesktopUpdateNotice } from '../src/client/DesktopUpdateNotice.tsx'
import type { DesktopUpdateNoticeProps } from '../src/client/DesktopUpdateNotice.tsx'
import type { DesktopUpdateState } from '../src/client/update-controller.ts'
import { apply, inject, SETTINGS_NS } from '../src/client/index.ts'
import { zh } from '../src/client/locales.ts'

usePinnedBrowserLanguages('zh-CN')
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const IDLE_STATE = {
  phase: 'idle',
  currentVersion: '0.1.0-rc.6',
  automaticChecks: true,
} as const

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  })
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'settings.section': { kind: 'list', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
  return { ctx, slots, locale }
}

function translate(key: keyof typeof zh, values: Record<string, string | number> = {}): string {
  return Object.entries(values).reduce(
    (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
    zh[key],
  )
}

describe('ui-desktop-update browser plugin', () => {
  it('declares only slot and locale services', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('registers a dedicated settings section and shell notification', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(IDLE_STATE))
    vi.stubGlobal('fetch', fetcher)
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(DesktopUpdateRow)
    expect(entry.options).toMatchObject({ id: 'desktop-update', order: 50 })
    expect(resolveSlotLabel(entry.options.label)).toBe('应用更新')
    expect(entry.locale).toBe(SETTINGS_NS)
    const translate = b.locale.bind(SETTINGS_NS)
    expect(translate('title')).toBe('应用更新')

    const injected = (entry.inject as unknown as () => DesktopUpdateRowInjected)()
    await injected.load()
    expect(injected.hooks.update.getSnapshot()).toEqual(IDLE_STATE)
    expect(fetcher).toHaveBeenCalledOnce()

    const noticeEntry = b.slots.entries('shell.overlay')[0]!
    expect(noticeEntry.component).toBe(DesktopUpdateNotice)
    expect(noticeEntry.options).toMatchObject({ id: 'desktop-update-notice', order: 50 })
    expect(noticeEntry.locale).toBe(SETTINGS_NS)

    b.locale.setLocale('en')
    expect(translate('title')).toBe('Application update')
    expect(resolveSlotLabel(entry.options.label)).toBe('Application update')

    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })

  it('renders version, automatic switch, then check action with adjacent status', () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const setAutomaticChecks = vi.fn().mockResolvedValue(undefined)
    const store = createSnapshotStore<DesktopUpdateState>({
      ...IDLE_STATE,
      phase: 'up-to-date',
    })
    const props = {
      useUpdate: bindSnapshotSelector(store),
      load,
      check: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue(undefined),
      install: vi.fn().mockResolvedValue(undefined),
      setAutomaticChecks,
      t: translate,
    } as unknown as DesktopUpdateRowProps

    render(<DesktopUpdateRow {...props} />)

    const section = screen.getByRole('region', { name: '应用更新' })
    expect(section.children[0]?.textContent).toBe('当前版本0.1.0-rc.6')
    expect(section.children[1]?.textContent).toContain('自动检查更新')
    const toggle = screen.getByRole('switch', { name: '自动检查更新' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(setAutomaticChecks).toHaveBeenCalledWith(false)

    const checkButton = screen.getByRole('button', { name: '检查更新' })
    const status = screen.getByRole('status')
    expect(section.children[2]?.firstElementChild).toBe(checkButton)
    expect(checkButton.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(status.textContent).toBe('当前已是最新版本')
  })

  it('keeps update discovery non-blocking and restores the action after download', () => {
    const download = vi.fn().mockResolvedValue(undefined)
    const install = vi.fn().mockResolvedValue(undefined)
    const store = createSnapshotStore<DesktopUpdateState>({
      ...IDLE_STATE,
      phase: 'available',
      installer: 'dmg',
      availableVersion: '0.1.0-rc.8',
      totalBytes: 128,
      downloadedBytes: 0,
    })
    const props = {
      useUpdate: bindSnapshotSelector(store),
      load: vi.fn().mockResolvedValue(undefined),
      check: vi.fn().mockResolvedValue(undefined),
      download,
      install,
      setAutomaticChecks: vi.fn().mockResolvedValue(undefined),
      t: translate,
    } as unknown as DesktopUpdateNoticeProps

    render(<DesktopUpdateNotice {...props} />)

    expect(screen.getByText('发现新版本')).toBeTruthy()
    expect(screen.getByText('0.1.0-rc.6 → 0.1.0-rc.8')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '下载更新' }))
    expect(download).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: '稍后' }))
    expect(screen.queryByText('发现新版本')).toBeNull()

    act(() => {
      store.set({
        ...store.getSnapshot(),
        phase: 'downloaded',
        downloadedBytes: 128,
      })
    })
    expect(screen.getByText('下载完成')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '退出并打开 DMG' }))
    expect(install).toHaveBeenCalledOnce()
  })

  it('shows background download progress in the shell notification', () => {
    const store = createSnapshotStore({
      ...IDLE_STATE,
      phase: 'downloading',
      installer: 'dmg',
      availableVersion: '0.1.0-rc.8',
      totalBytes: 200,
      downloadedBytes: 50,
    } as const)
    const props = {
      useUpdate: bindSnapshotSelector(store),
      load: vi.fn().mockResolvedValue(undefined),
      check: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue(undefined),
      install: vi.fn().mockResolvedValue(undefined),
      setAutomaticChecks: vi.fn().mockResolvedValue(undefined),
      t: translate,
    } as unknown as DesktopUpdateNoticeProps

    render(<DesktopUpdateNotice {...props} />)

    expect(screen.getByText('安装包下载进度 25%，完成后会再次提醒。')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
  })
})
