/** Dedicated Remote Control settings section. */

import { useEffect, useRef, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteControlLocaleKey } from './locales.ts'
import type { RemoteControlView } from './controller.ts'
import css from './RemoteControlSection.module.css'

export interface RemoteControlSectionInjected {
  hooks: { remoteControl: SnapshotStore<RemoteControlView> }
  load: () => Promise<void>
  configure: (request: { enabled: boolean; relayUrl: string; computerName: string }) => Promise<void>
  reconnect: () => Promise<void>
  openPairing: () => Promise<void>
  confirmPairing: () => Promise<void>
  revoke: (deviceId: string) => Promise<void>
}

export type RemoteControlSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.remote-control'>
  & InjectFace<RemoteControlSectionInjected>

export function RemoteControlSection({
  useRemoteControl, load, configure, reconnect, openPairing, confirmPairing, revoke, t,
}: RemoteControlSectionProps) {
  const view = useRemoteControl(value => value)
  const [enabled, setEnabled] = useState(view.state.preferences.enabled)
  const [relayUrl, setRelayUrl] = useState(view.state.preferences.relayUrl)
  const [computerName, setComputerName] = useState(view.state.preferences.computerName)
  const autoPairingRequested = useRef(false)

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => { void load() }, 1500)
    return () => { window.clearInterval(timer) }
  }, [load])
  useEffect(() => {
    setEnabled(view.state.preferences.enabled)
    setRelayUrl(view.state.preferences.relayUrl)
    setComputerName(view.state.preferences.computerName)
  }, [
    view.state.preferences.enabled,
    view.state.preferences.relayUrl,
    view.state.preferences.computerName,
  ])
  useEffect(() => {
    if (view.state.phase !== 'connected') {
      autoPairingRequested.current = false
      return
    }
    if (view.busy === 'configure' || view.busy === 'reconnect') {
      autoPairingRequested.current = false
      return
    }
    if (view.state.pendingDevice !== undefined) return
    if (view.offer !== null || view.busy !== null || autoPairingRequested.current) return
    autoPairingRequested.current = true
    void openPairing()
  }, [openPairing, view.busy, view.offer, view.state.pendingDevice, view.state.phase])
  useEffect(() => {
    if (view.offer !== null) autoPairingRequested.current = false
  }, [view.offer])
  useEffect(() => {
    if (view.offer === null || view.state.pendingDevice !== undefined) return
    const delay = Math.max(0, view.offer.expiresAt - Date.now() + 250)
    const timer = window.setTimeout(() => { void openPairing() }, delay)
    return () => { window.clearTimeout(timer) }
  }, [openPairing, view.offer, view.state.pendingDevice])

  const busy = view.busy !== null
  const phaseKey = `phase.${view.state.phase}` as RemoteControlLocaleKey
  const statusError = view.error ?? view.state.error

  return (
    <section className={css.section} aria-label={t('title')}>
      <header className={css.header}>
        <div>
          <h2>{t('title')}</h2>
          <p>{t('description')}</p>
        </div>
        <span className={css.status} data-phase={view.state.phase} role={statusError == null ? 'status' : 'alert'}>
          {statusError ?? t(phaseKey)}
        </span>
      </header>

      <div className={css.card}>
        <label className={css.toggleRow}>
          <span>{t('enabled')}</span>
          <input type="checkbox" checked={enabled} onChange={(event) => { setEnabled(event.currentTarget.checked) }} />
        </label>
        {view.state.relayMode === 'custom' && (
          <label className={css.field}>
            <span>{t('relay')}</span>
            <input value={relayUrl} spellCheck={false} onChange={(event) => { setRelayUrl(event.currentTarget.value) }} />
          </label>
        )}
        <label className={css.field}>
          <span>{t('computerName')}</span>
          <input value={computerName} maxLength={80} onChange={(event) => { setComputerName(event.currentTarget.value) }} />
        </label>
        <div className={css.actions}>
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => { void configure({ enabled, relayUrl, computerName }) }}
          >
            {busy ? t('busy') : t('save')}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { void reconnect() }}>
            {t('reconnect')}
          </Button>
        </div>
        <div className={css.identity}><span>{t('computerId')}</span><code>{view.state.computerId}</code></div>
      </div>

      <div className={css.card}>
        <div className={css.cardHeading}>
          <div>
            <h3>{t('pairTitle')}</h3>
            <p>{t('qrHint')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || view.state.phase !== 'connected'}
            onClick={() => { void openPairing() }}
          >
            {view.busy === 'openPairing'
              ? t('generating')
              : t(view.offer === null ? 'generate' : 'refresh')}
          </Button>
        </div>
        {view.offer !== null && (
          <div className={css.qrBlock}>
            <img src={view.offer.qrDataUrl} alt={t('generate')} width={280} height={280} />
            <div className={css.qrMeta}>
              <strong>{t(view.offer.mode === 'miniprogram-code' ? 'directCode' : 'fallbackCode')}</strong>
              <span>{t('fingerprint')}</span>
              <strong>{view.offer.fingerprint}</strong>
              <span>{t('expires', { time: new Date(view.offer.expiresAt).toLocaleTimeString() })}</span>
            </div>
          </div>
        )}
        {view.state.pendingDevice !== undefined && (
          <div className={css.pending}>
            <div>
              <strong>{t('pending')}</strong>
              <span>{t('pendingFingerprint', { fingerprint: view.state.pendingDevice.fingerprint })}</span>
            </div>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => { void confirmPairing() }}>
              {t('confirm')}
            </Button>
          </div>
        )}
      </div>

      <div className={css.card}>
        <h3>{t('devices')}</h3>
        {view.state.pairedDevices.length === 0 ? <p className={css.empty}>{t('noDevices')}</p> : (
          <ul className={css.devices}>
            {view.state.pairedDevices.map(device => (
              <li key={device.deviceId}>
                <div><code>{device.deviceId}</code><span>{device.revoked ? t('revoked') : t('active')}</span></div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || device.revoked}
                  onClick={() => {
                    if (window.confirm(t('revokeConfirm'))) void revoke(device.deviceId)
                  }}
                >
                  {t('revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
