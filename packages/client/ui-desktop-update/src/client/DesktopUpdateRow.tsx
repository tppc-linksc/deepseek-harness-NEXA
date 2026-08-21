/** Dedicated settings section for desktop application updates. */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button, IconCheckOutline16, IconDownloadOutline16, IconRefreshOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopUpdateKey } from './locales.ts'
import type { DesktopUpdateState } from './update-controller.ts'
import { installActionKey } from './update-copy.ts'
import css from './DesktopUpdateRow.module.css'

/** Registration-side business face for private desktop update operations. */
export interface DesktopUpdateRowInjected {
  hooks: {
    /** Main-process update snapshot bound by the renderer as useUpdate. */
    update: SnapshotStore<DesktopUpdateState>
  }
  /** Load current updater state. */
  load: () => Promise<void>
  /** Check the release feed now. */
  check: () => Promise<void>
  /** Download and verify the selected installer. */
  download: () => Promise<void>
  /** Open the verified installer. */
  install: () => Promise<void>
  /** Persist the automatic daily-check preference. */
  setAutomaticChecks: (enabled: boolean) => Promise<void>
}

/** Full component props. */
export type DesktopUpdateRowProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.desktop-update'>
  & InjectFace<DesktopUpdateRowInjected>

function progressOf(state: DesktopUpdateState): number {
  if (state.totalBytes === undefined || state.totalBytes === 0) return 0
  return Math.min(100, Math.round(((state.downloadedBytes ?? 0) / state.totalBytes) * 100))
}

function statusKey(state: DesktopUpdateState): DesktopUpdateKey {
  switch (state.phase) {
    case 'checking': return 'status.checking'
    case 'up-to-date': return 'status.current'
    case 'available': return 'status.available'
    case 'downloading': return 'status.downloading'
    case 'downloaded': return 'status.downloaded'
    case 'installing': return 'status.installing'
    case 'unsupported': return 'status.unsupported'
    case 'error': return 'status.error'
    case 'idle': return 'status.idle'
  }
}

/**
 * Render update status, preference, progress, and explicit update actions.
 * @param props - composed slot props.
 * @returns the desktop application update row.
 */
export function DesktopUpdateRow({
  useUpdate, load, check, download, install, setAutomaticChecks, t,
}: DesktopUpdateRowProps) {
  const state = useUpdate(snapshot => snapshot)

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (state.phase !== 'downloading' && state.phase !== 'installing') return
    const timer = window.setInterval(() => { void load() }, 500)
    return () => { window.clearInterval(timer) }
  }, [load, state.phase])

  const progress = progressOf(state)
  const status = state.error ?? t(statusKey(state), {
    version: state.availableVersion ?? '',
    progress,
  })
  const busy = state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'installing'

  return (
    <section className={css.group} aria-label={t('title')}>
      <div className={css.row}>
        <span className={css.rowTitle}>{t('current')}</span>
        <span className={css.version}>{state.currentVersion}</span>
      </div>
      <div className={css.row}>
        <span className={css.preferenceCopy}>
          <span className={css.rowTitle}>{t('automatic')}</span>
          <span className={css.preferenceDesc}>{t('automatic.description')}</span>
        </span>
        <button
          type="button"
          className={css.switch}
          role="switch"
          aria-label={t('automatic')}
          aria-checked={state.automaticChecks}
          disabled={busy}
          onClick={() => { void setAutomaticChecks(!state.automaticChecks) }}
        >
          <span className={css.switchThumb} aria-hidden="true" />
        </button>
      </div>
      <div className={css.actionRow}>
        <Button
          variant="outline"
          size="sm"
          icon={state.phase === 'up-to-date' ? <IconCheckOutline16 /> : <IconRefreshOutline16 />}
          disabled={busy}
          onClick={() => { void check() }}
        >
          {t('check')}
        </Button>
        <div className={css.status} role={state.phase === 'error' ? 'alert' : 'status'}>
          <span>{status}</span>
          {state.upstreamVersion !== undefined && (
            <span className={css.upstream}>{t('upstream', { version: state.upstreamVersion })}</span>
          )}
        </div>
        {state.phase === 'available' && (
          <Button
            variant="primary"
            size="sm"
            icon={<IconDownloadOutline16 />}
            onClick={() => { void download() }}
          >
            {t('download')}
          </Button>
        )}
        {state.phase === 'downloaded' && (
          <Button variant="primary" size="sm" onClick={() => { void install() }}>
            {t(installActionKey(state.installer))}
          </Button>
        )}
      </div>
      {(state.phase === 'downloading' || state.phase === 'installing') && (
        <div
          className={css.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
    </section>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Desktop application update section copy. */
    'settings.desktop-update': DesktopUpdateKey
  }
}
