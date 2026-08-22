// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSnapshotStore, SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { bindSnapshotSelector, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import type { RemoteControlState } from '@deepseek-ai/dsh-qrcode-remote/types'
import { RemoteControlAction } from '../src/client/RemoteControlAction.tsx'
import type {
  RemoteControlActionInjected, RemoteControlActionProps,
} from '../src/client/RemoteControlAction.tsx'
import { RemoteControlController, type RemoteControlRemote } from '../src/client/controller.ts'
import { apply, inject, NS } from '../src/client/index.ts'
import { zh } from '../src/client/locales.ts'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const DISABLED: RemoteControlState = {
  phase: 'disabled',
  relayMode: 'managed',
  preferences: {
    enabled: false,
    relayUrl: 'wss://relay.tppc.top',
    computerName: 'My computer',
  },
  computerId: 'computer-id',
  pairedDevices: [],
}

const CONNECTED: RemoteControlState = {
  ...DISABLED,
  phase: 'connected',
  preferences: { ...DISABLED.preferences, enabled: true },
}

function success<T>(value: T) {
  return Promise.resolve({ ok: true as const, value })
}

function pairingOffer() {
  return {
    qrDataUrl: 'data:image/png;base64,AA==',
    payload: 'NEXA:PAYLOAD',
    mode: 'miniprogram-code' as const,
    fingerprint: 'ABCDEFGH',
    computerName: 'My computer',
    expiresAt: Date.now() + 60_000,
  }
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
    openPairing: vi.fn(() => success(pairingOffer())),
    confirmPairing: vi.fn(() => success(DISABLED)),
    revoke: vi.fn(() => success(DISABLED)),
  }
  ctx.provide('remote.remoteControl', remote)
  ctx.slots.register({
    name: 'root',
    children: { 'sidebar.footer.action': { kind: 'list', scope: 'root' } },
  } as never, () => null)
  return { ctx, locale, remote }
}

function propsFor(
  state: RemoteControlState,
  overrides: Partial<RemoteControlActionProps> = {},
): RemoteControlActionProps {
  const store = createSnapshotStore({ state, offer: null, busy: null, error: null })
  return {
    wide: true,
    useRemoteControl: bindSnapshotSelector(store),
    load: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn().mockResolvedValue(undefined),
    openPairing: vi.fn().mockResolvedValue(undefined),
    t: (key: keyof typeof zh) => zh[key],
    ...overrides,
  } as unknown as RemoteControlActionProps
}

describe('ui-remote-control browser plugin', () => {
  it('registers a localized sidebar footer action instead of a Settings section', async () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.remoteControl'])
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = b.ctx.slots.entries('sidebar.footer.action')[0]!
    expect(entry.component).toBe(RemoteControlAction)
    expect(entry.options).toMatchObject({ id: 'remote-control', order: 80 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('连接移动端')
    const injected = (entry.inject as unknown as () => RemoteControlActionInjected)()
    await injected.load()
    expect(injected.hooks.remoteControl.getSnapshot().state).toEqual(DISABLED)
    expect(b.remote.state).toHaveBeenCalledOnce()

    b.locale.setLocale('en')
    expect(resolveSlotLabel(entry.options.label)).toBe('Connect mobile')
    await fiber.dispose()
    expect(b.ctx.slots.entries('sidebar.footer.action')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })

  it('publishes pairing offers and preserves a safe error for failed Host actions', async () => {
    const remote = {
      state: vi.fn(() => success(DISABLED)),
      configure: vi.fn(() => success(DISABLED)),
      reconnect: vi.fn(() => success(DISABLED)),
      openPairing: vi.fn(() => success(pairingOffer())),
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
    await controller.revoke('missing-phone')
    expect(controller.store.getSnapshot()).toMatchObject({
      busy: null,
      error: 'REMOTE_ERROR: device not found',
    })
    controller.dispose()
  })

  it('removes a consumed pairing code while the invisible handshake completes', async () => {
    const pending: RemoteControlState = {
      ...CONNECTED,
      pendingDevice: { deviceId: 'phone-1', fingerprint: 'ABCDEFGH', expiresAt: Date.now() + 60_000 },
    }
    const remote = {
      state: vi.fn(() => success(pending)),
      configure: vi.fn(() => success(pending)),
      reconnect: vi.fn(() => success(pending)),
      openPairing: vi.fn(() => success(pairingOffer())),
      confirmPairing: vi.fn(() => success(CONNECTED)),
      revoke: vi.fn(() => success(pending)),
    } satisfies RemoteControlRemote
    const controller = new RemoteControlController(remote)

    await controller.openPairing()
    expect(controller.store.getSnapshot().offer).not.toBeNull()
    await controller.load()
    expect(controller.store.getSnapshot().offer).toBeNull()
    controller.dispose()
  })

  it('opens a compact popover and automatically requests the computer-specific code', async () => {
    const openPairing = vi.fn().mockResolvedValue(undefined)
    render(<RemoteControlAction {...propsFor(CONNECTED, { openPairing })} />)

    fireEvent.click(screen.getByRole('button', { name: '连接移动端' }))

    expect(await screen.findByRole('region', { name: '连接移动端' })).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: '允许移动端连接此设备' }).checked)
      .toBe(true)
    expect(screen.queryByText('Relay 地址')).toBeNull()
    expect(screen.queryByText('电脑 ID')).toBeNull()
    expect(screen.queryByText('电脑指纹')).toBeNull()
    await waitFor(() => { expect(openPairing).toHaveBeenCalledOnce() })
  })

  it('shows the generated WeChat code without confirmation or enter-session controls', () => {
    const store = createSnapshotStore({
      state: CONNECTED,
      offer: pairingOffer(),
      busy: null,
      error: null,
    })
    const props = propsFor(CONNECTED, { useRemoteControl: bindSnapshotSelector(store) })
    render(<RemoteControlAction {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '连接移动端' }))

    expect(screen.getByRole('img', { name: '连接这台电脑的微信小程序码' })).toBeTruthy()
    expect(screen.getByText('使用微信扫码连接电脑')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '确认配对' })).toBeNull()
    expect(screen.queryByRole('button', { name: '进入会话' })).toBeNull()
  })

  it('keeps the enable switch as the only visible preference', () => {
    const setEnabled = vi.fn().mockResolvedValue(undefined)
    render(<RemoteControlAction {...propsFor(DISABLED, { setEnabled })} />)

    fireEvent.click(screen.getByRole('button', { name: '连接移动端' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '允许移动端连接此设备' }))

    expect(setEnabled).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
