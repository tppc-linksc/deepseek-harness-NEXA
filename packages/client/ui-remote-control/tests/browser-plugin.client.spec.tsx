// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSnapshotStore, SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { bindSnapshotSelector, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import type { RemoteControlState } from '@deepseek-ai/dsh-qrcode-remote/types'
import { RemoteControlSection } from '../src/client/RemoteControlSection.tsx'
import type {
  RemoteControlSectionInjected, RemoteControlSectionProps,
} from '../src/client/RemoteControlSection.tsx'
import { RemoteControlController, type RemoteControlRemote } from '../src/client/controller.ts'
import { apply, inject, NS } from '../src/client/index.ts'
import { zh } from '../src/client/locales.ts'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const DISABLED: RemoteControlState = {
  phase: 'disabled',
  relayMode: 'custom',
  preferences: {
    enabled: false,
    relayUrl: 'wss://relay.example.com',
    computerName: 'My computer',
  },
  computerId: 'computer-id',
  pairedDevices: [],
}

function success<T>(value: T) {
  return Promise.resolve({ ok: true as const, value })
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  const remote: RemoteControlRemote = {
    state: vi.fn(() => success(DISABLED)),
    configure: vi.fn(() => success(DISABLED)),
    reconnect: vi.fn(() => success(DISABLED)),
    openPairing: vi.fn(() => success({
      qrDataUrl: 'data:image/png;base64,AA==',
      payload: 'NEXA:PAYLOAD',
      mode: 'miniprogram-code' as const,
      fingerprint: 'ABCDEFGH',
      computerName: 'My computer',
      expiresAt: 1_900_000_000_000,
    })),
    confirmPairing: vi.fn(() => success(DISABLED)),
    revoke: vi.fn(() => success(DISABLED)),
  }
  ctx.provide('remote.remoteControl', remote)
  ctx.slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
  return { ctx, locale, remote }
}

describe('ui-remote-control browser plugin', () => {
  it('registers the localized Remote Control settings section and typed actions', async () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.remoteControl'])
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = b.ctx.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(RemoteControlSection)
    expect(entry.options).toMatchObject({ id: 'remote-control', order: 40 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('远程操控')
    const injected = (entry.inject as unknown as () => RemoteControlSectionInjected)()
    await injected.load()
    expect(injected.hooks.remoteControl.getSnapshot().state).toEqual(DISABLED)
    expect(b.remote.state).toHaveBeenCalledOnce()

    b.locale.setLocale('en')
    expect(resolveSlotLabel(entry.options.label)).toBe('Remote Control')
    await fiber.dispose()
    expect(b.ctx.slots.entries('settings.section')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })

  it('publishes pairing offers and preserves a safe error for failed actions', async () => {
    const remote = {
      state: vi.fn(() => success(DISABLED)),
      configure: vi.fn(() => success(DISABLED)),
      reconnect: vi.fn(() => success(DISABLED)),
      openPairing: vi.fn(() => success({
        qrDataUrl: 'data:image/png;base64,AA==',
        payload: 'NEXA:PAYLOAD',
        mode: 'miniprogram-code' as const,
        fingerprint: 'ABCDEFGH',
        computerName: 'My computer',
        expiresAt: 1_900_000_000_000,
      })),
      confirmPairing: vi.fn(() => success(DISABLED)),
      revoke: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'REMOTE_ERROR', message: 'device not found' },
      }),
    } satisfies RemoteControlRemote
    const controller = new RemoteControlController(remote)

    await controller.openPairing()
    expect(controller.store.getSnapshot()).toMatchObject({
      offer: { payload: 'NEXA:PAYLOAD', fingerprint: 'ABCDEFGH' },
      busy: null,
      error: null,
    })
    await controller.load()
    expect(controller.store.getSnapshot().offer).not.toBeNull()
    await controller.revoke('missing-phone')
    expect(controller.store.getSnapshot()).toMatchObject({
      busy: null,
      error: 'REMOTE_ERROR: device not found',
    })
    controller.dispose()
  })

  it('removes a consumed pairing code while a phone waits for computer confirmation', async () => {
    const pending: RemoteControlState = {
      ...DISABLED,
      phase: 'connected',
      pendingDevice: { deviceId: 'phone-1', fingerprint: 'ABCDEFGH', expiresAt: Date.now() + 60_000 },
    }
    const confirmed: RemoteControlState = {
      ...DISABLED,
      phase: 'connected',
    }
    const remote = {
      state: vi.fn(() => success(pending)),
      configure: vi.fn(() => success(pending)),
      reconnect: vi.fn(() => success(pending)),
      openPairing: vi.fn(() => success({
        qrDataUrl: 'data:image/png;base64,AA==', payload: 'NEXA:PAYLOAD',
        mode: 'miniprogram-code' as const, fingerprint: 'ABCDEFGH',
        computerName: 'My computer', expiresAt: Date.now() + 60_000,
      })),
      confirmPairing: vi.fn(() => success(confirmed)),
      revoke: vi.fn(() => success(pending)),
    } satisfies RemoteControlRemote
    const controller = new RemoteControlController(remote)

    await controller.openPairing()
    expect(controller.store.getSnapshot().offer).not.toBeNull()
    await controller.load()
    expect(controller.store.getSnapshot().offer).toBeNull()

    await controller.openPairing()
    await controller.confirmPairing()
    expect(controller.store.getSnapshot().offer).toBeNull()
    controller.dispose()
  })

  it('does not overwrite an in-progress Relay edit when polling returns equivalent preferences', () => {
    const store = createSnapshotStore({ state: DISABLED, offer: null, busy: null, error: null })
    const props = {
      useRemoteControl: bindSnapshotSelector(store),
      load: vi.fn().mockResolvedValue(undefined),
      configure: vi.fn().mockResolvedValue(undefined),
      reconnect: vi.fn().mockResolvedValue(undefined),
      openPairing: vi.fn().mockResolvedValue(undefined),
      confirmPairing: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue(undefined),
      t: (key: keyof typeof zh) => zh[key],
    } as unknown as RemoteControlSectionProps
    render(<RemoteControlSection {...props} />)
    const relayInput = screen.getByRole('textbox', { name: 'Relay 地址' }) as HTMLInputElement

    fireEvent.change(relayInput, { target: { value: 'wss://editing.example.com' } })
    act(() => {
      store.set({
        ...store.getSnapshot(),
        state: { ...DISABLED, preferences: { ...DISABLED.preferences } },
      })
    })

    expect(relayInput.value).toBe('wss://editing.example.com')
  })

  it('hides the managed Relay and generates a pairing code automatically after connection', async () => {
    const connected: RemoteControlState = {
      ...DISABLED,
      phase: 'connected',
      relayMode: 'managed',
      preferences: {
        ...DISABLED.preferences,
        enabled: true,
        relayUrl: 'wss://relay.tppc.top',
      },
    }
    const store = createSnapshotStore({ state: connected, offer: null, busy: null, error: null })
    const openPairing = vi.fn().mockResolvedValue(undefined)
    const props = {
      useRemoteControl: bindSnapshotSelector(store),
      load: vi.fn().mockResolvedValue(undefined),
      configure: vi.fn().mockResolvedValue(undefined),
      reconnect: vi.fn().mockResolvedValue(undefined),
      openPairing,
      confirmPairing: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue(undefined),
      t: (key: keyof typeof zh) => zh[key],
    } as unknown as RemoteControlSectionProps

    render(<RemoteControlSection {...props} />)

    expect(screen.queryByRole('textbox', { name: 'Relay 地址' })).toBeNull()
    await waitFor(() => { expect(openPairing).toHaveBeenCalledOnce() })
  })

  it('does not replace the consumed code while a phone proposal is pending', async () => {
    const connected: RemoteControlState = {
      ...DISABLED,
      phase: 'connected',
      pendingDevice: { deviceId: 'phone-1', fingerprint: 'ABCDEFGH', expiresAt: Date.now() + 60_000 },
    }
    const store = createSnapshotStore({ state: connected, offer: null, busy: null, error: null })
    const openPairing = vi.fn().mockResolvedValue(undefined)
    const props = {
      useRemoteControl: bindSnapshotSelector(store),
      load: vi.fn().mockResolvedValue(undefined),
      configure: vi.fn().mockResolvedValue(undefined),
      reconnect: vi.fn().mockResolvedValue(undefined),
      openPairing,
      confirmPairing: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue(undefined),
      t: (key: keyof typeof zh) => zh[key],
    } as unknown as RemoteControlSectionProps

    render(<RemoteControlSection {...props} />)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(openPairing).not.toHaveBeenCalled()
  })
})
