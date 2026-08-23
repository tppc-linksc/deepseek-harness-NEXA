/** Sidebar-foot entry that opens the compact mobile-connection surface. */

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { RemoteControlView } from './controller.ts'
import css from './RemoteControlAction.module.css'

export interface RemoteControlActionInjected {
  hooks: { remoteControl: SnapshotStore<RemoteControlView> }
  load: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  openPairing: () => Promise<void>
}

export type RemoteControlActionProps =
  PropsRuntime<'sidebar.footer.trailing'>
  & PropsLocale<'remote-control'>
  & InjectFace<RemoteControlActionInjected>

function ConnectDeviceIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.75" y="4.25" width="12.5" height="9.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 17.5h6M9 14v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="16.25" y="8.25" width="5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 16.5h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Render one sidebar action and its QR popover. The component only projects
 * Host state; all pairing authorization and Session execution stay on the computer.
 */
export function RemoteControlAction({
  useRemoteControl, load, setEnabled, openPairing, t,
}: RemoteControlActionProps) {
  const view = useRemoteControl(value => value)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<{ left: number; bottom: number }>()

  useDismissOnOutsidePointer(rootRef, open, setOpen)

  useLayoutEffect(() => {
    if (!open) return
    const place = (): void => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const width = Math.min(336, window.innerWidth - 24)
      setAnchor({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        bottom: window.innerHeight - rect.top + 8,
      })
    }
    place()
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place) }
  }, [open])

  useEffect(() => {
    if (!open) return
    void load()
    const timer = window.setInterval(() => { void load() }, 1_500)
    return () => { window.clearInterval(timer) }
  }, [load, open])

  // Opening this surface is the computer-side authorization gesture. Once the
  // managed Relay is ready, one fresh challenge is created without another click.
  useEffect(() => {
    if (!open
      || !view.state.preferences.enabled
      || view.state.phase !== 'connected'
      || view.state.pendingDevice !== undefined
      || view.offer !== null
      || view.busy !== null) return
    void openPairing()
  }, [open, openPairing, view.busy, view.offer, view.state.pendingDevice,
    view.state.phase, view.state.preferences.enabled])

  useEffect(() => {
    if (!open || view.offer === null || view.state.pendingDevice !== undefined) return
    const delay = Math.max(0, view.offer.expiresAt - Date.now() + 250)
    const timer = window.setTimeout(() => { void openPairing() }, delay)
    return () => { window.clearTimeout(timer) }
  }, [open, openPairing, view.offer, view.state.pendingDevice])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    setOpen(false)
    triggerRef.current?.focus()
  }

  const enabled = view.state.preferences.enabled
  const statusError = view.error ?? view.state.error ?? null
  const waiting = enabled && statusError === null && (
    view.busy !== null
    || view.state.phase === 'connecting'
    || view.state.phase === 'disconnected'
    || (view.state.phase === 'connected' && view.offer === null)
  )

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onKeyDown}>
      {open && anchor !== undefined && (
        <section className={css.panel} style={anchor} aria-label={t('title')} data-remote-control-panel>
          <header className={css.header}>
            <div>
              <h2>{t('title')}</h2>
              <p>{t('subtitle')}</p>
            </div>
            <label className={css.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={view.busy !== null}
                aria-label={t('enabled')}
                onChange={(event) => { void setEnabled(event.currentTarget.checked) }}
              />
              <span aria-hidden />
            </label>
          </header>

          {!enabled && <p className={css.notice}>{t('disabled')}</p>}
          {enabled && statusError !== null && (
            <div className={css.error} role="alert">
              <span>{t('error')}</span>
              <button type="button" onClick={() => { void openPairing() }}>{t('retry')}</button>
            </div>
          )}
          {enabled && view.offer?.mode === 'miniprogram-code' && (
            <div className={css.qr}>
              <img src={view.offer.qrDataUrl} alt={t('qrAlt')} width={248} height={248} />
              <strong>{t('scan')}</strong>
              <span>{t('hint')}</span>
            </div>
          )}
          {enabled && view.offer?.mode === 'fallback-qr' && (
            <div className={css.error} role="alert">
              <span>{t('codeUnavailable')}</span>
              <button type="button" onClick={() => { void openPairing() }}>{t('retry')}</button>
            </div>
          )}
          {enabled && waiting && (
            <div className={css.loading} role="status">
              <span className={css.spinner} aria-hidden />
              <span>{view.state.pendingDevice === undefined ? t('loading') : t('connecting')}</span>
            </div>
          )}
          <p className={css.security}>{t('security')}</p>
        </section>
      )}
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        data-active={open || undefined}
        aria-label={t('nav')}
        title={t('nav')}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <ConnectDeviceIcon size={20} />
      </button>
    </div>
  )
}
