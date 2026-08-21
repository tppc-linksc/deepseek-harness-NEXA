/** Non-blocking shell notification for desktop update progress and handoff. */

import { useEffect, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button,
  IconCheckOutline16,
  IconCloseOutline16,
  IconDownloadOutline16,
  IconRefreshOutline16,
  IconWarningOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopUpdateRowInjected } from './DesktopUpdateRow.tsx'
import type { DesktopUpdateKey } from './locales.ts'
import type { DesktopUpdateState } from './update-controller.ts'
import { downloadedDetailKey, installActionKey } from './update-copy.ts'
import css from './DesktopUpdateNotice.module.css'

const UPDATE_STATE_POLL_MS = 500

/** Full shell-overlay component props. */
export type DesktopUpdateNoticeProps =
  PropsRuntime<'shell.overlay'>
  & PropsLocale<'settings.desktop-update'>
  & InjectFace<DesktopUpdateRowInjected>

function progressOf(state: DesktopUpdateState): number {
  if (state.totalBytes === undefined || state.totalBytes === 0) return 0
  return Math.min(100, Math.round(((state.downloadedBytes ?? 0) / state.totalBytes) * 100))
}

function titleKey(state: DesktopUpdateState): DesktopUpdateKey {
  switch (state.phase) {
    case 'available': return 'notice.available.title'
    case 'downloading': return 'notice.downloading.title'
    case 'downloaded': return 'notice.downloaded.title'
    case 'installing': return 'notice.installing.title'
    case 'error': return 'notice.error.title'
    case 'checking':
    case 'idle':
    case 'unsupported':
    case 'up-to-date': return 'title'
  }
}

function notificationKey(state: DesktopUpdateState): string {
  return `${state.phase}:${state.availableVersion ?? ''}:${state.error ?? ''}`
}

function isVisible(state: DesktopUpdateState): boolean {
  return state.phase === 'available'
    || state.phase === 'downloading'
    || state.phase === 'downloaded'
    || state.phase === 'installing'
    || state.phase === 'error'
}

/**
 * Render the frame-wide update reminder without blocking the active workspace.
 * @param props - composed shell-overlay props.
 * @returns the update notification, or nothing for quiet updater phases.
 */
export function DesktopUpdateNotice({
  useUpdate, load, check, download, install, t,
}: DesktopUpdateNoticeProps) {
  const state = useUpdate(snapshot => snapshot)
  const [dismissed, setDismissed] = useState<string>()

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (state.phase !== 'checking' && state.phase !== 'downloading' && state.phase !== 'installing') return
    const timer = window.setInterval(() => { void load() }, UPDATE_STATE_POLL_MS)
    return () => { window.clearInterval(timer) }
  }, [load, state.phase])

  const key = notificationKey(state)
  if (!isVisible(state) || dismissed === key) return null

  const progress = progressOf(state)
  const detail = state.phase === 'available'
    ? t('notice.available.body')
    : state.phase === 'downloading'
      ? t('notice.downloading.body', { progress })
      : state.phase === 'downloaded'
        ? t(downloadedDetailKey(state.installer))
        : state.phase === 'installing'
          ? t('notice.installing.body')
          : state.error ?? t('notice.error.body')
  const icon = state.phase === 'error'
    ? <IconWarningOutline16 />
    : state.phase === 'downloaded'
      ? <IconCheckOutline16 />
      : state.phase === 'available' || state.phase === 'downloading'
        ? <IconDownloadOutline16 />
        : <IconRefreshOutline16 />

  return (
    <aside
      className={css.notice}
      data-desktop-update-notice={state.phase}
      role={state.phase === 'error' ? 'alert' : 'status'}
      aria-live={state.phase === 'error' ? 'assertive' : 'polite'}
    >
      <div className={css.header}>
        <span className={css.icon} aria-hidden="true">{icon}</span>
        <div className={css.heading}>
          <strong>{t(titleKey(state))}</strong>
          {state.availableVersion !== undefined && (
            <span>{t('notice.version', {
              current: state.currentVersion,
              available: state.availableVersion,
            })}</span>
          )}
        </div>
        <button
          type="button"
          className={css.close}
          aria-label={t('notice.close')}
          onClick={() => { setDismissed(key) }}
        >
          <IconCloseOutline16 />
        </button>
      </div>
      <p className={css.detail}>{detail}</p>
      {state.phase === 'downloading' && (
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
      <div className={css.actions}>
        {state.phase === 'available' && (
          <Button variant="primary" size="sm" onClick={() => { void download() }}>
            {t('download')}
          </Button>
        )}
        {state.phase === 'downloaded' && (
          <Button variant="primary" size="sm" onClick={() => { void install() }}>
            {t(installActionKey(state.installer))}
          </Button>
        )}
        {state.phase === 'error' && (
          <Button variant="primary" size="sm" onClick={() => { void check() }}>
            {t('notice.retry')}
          </Button>
        )}
        {(state.phase === 'available' || state.phase === 'downloaded') && (
          <Button variant="outline" size="sm" onClick={() => { setDismissed(key) }}>
            {t('notice.later')}
          </Button>
        )}
      </div>
    </aside>
  )
}
