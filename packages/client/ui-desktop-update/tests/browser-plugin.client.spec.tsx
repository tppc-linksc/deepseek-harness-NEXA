// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSnapshotStore, SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { DesktopUpdateRow } from '../src/client/DesktopUpdateRow.tsx'
import type { DesktopUpdateRowInjected, DesktopUpdateRowProps } from '../src/client/DesktopUpdateRow.tsx'
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
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
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

  it('registers a dedicated localized update section', async () => {
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

    b.locale.setLocale('en')
    expect(translate('title')).toBe('Application update')
    expect(resolveSlotLabel(entry.options.label)).toBe('Application update')

    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })

  it('renders version, automatic switch, then check action with adjacent status', () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const setAutomaticChecks = vi.fn().mockResolvedValue(undefined)
    const store = createSnapshotStore({
      ...IDLE_STATE,
      phase: 'up-to-date',
    } as const)
    const props = {
      useUpdate: bindSnapshotSelector(store),
      load,
      check: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
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
})
