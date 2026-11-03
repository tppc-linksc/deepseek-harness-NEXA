/**
 * Official-DeepSeek first-run step. Readiness comes from the same
 * provider/settings/credential join as the Models page: any provider the user
 * can already talk to ends the step, and only a user with none is offered the
 * official DeepSeek route. The step reuses that page's credential editor in
 * the onboarding plugin's shared modal, so the key is entered once.
 */

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelsSettingsState, ModelsSettingsStore } from './store.ts'
import { onboardingReadiness } from './store.ts'
import { ProviderEditor } from './ProviderEditor.tsx'
import type { en } from './locales.ts'
import { OnboardingModal } from './OnboardingModal.tsx'
import styles from './DeepSeekOnboardingDialog.module.css'
import {
  DEEPSEEK_ONBOARDING_SKIP_FIELD, DEEPSEEK_ONBOARDING_SKIP_VALUE,
  WELCOME_NOTICE_SETTINGS_NAMESPACE,
} from '../onboarding-copy.ts'

/** Registration-side dependencies of {@link DeepSeekOnboardingDialog}. */
export interface DeepSeekOnboardingInjected {
  hooks: {
    /** Shared Models-page join state, bound by the slot renderer. */
    models: SnapshotStore<ModelsSettingsState>
  }
  /** Shared Models-page join controller. */
  controller: ModelsSettingsStore
  /** Existing wire face reused by the Models credential editor. */
  api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>
  /** Feature copy. */
  t: (key: keyof typeof en) => string
}

/** Slot owner props plus the feature's injected dependencies. */
export type DeepSeekOnboardingDialogProps =
  PropsRuntime<'settings.onboarding'> & InjectFace<DeepSeekOnboardingInjected>

/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
function assertNever(_value: never): never {
  throw new Error('unexpected DeepSeek onboarding state')
}

/**
 * Prompt a first-run user for the official DeepSeek credential while no
 * provider can serve requests and that credential is writable.
 * @param props - settings-shell owner state and Models feature dependencies.
 * @returns the onboarding modal or null when onboarding needs no intervention.
 */
export function DeepSeekOnboardingDialog(props: DeepSeekOnboardingDialogProps): ReactNode {
  const { complete, controller, useModels, api, t } = props
  const state = useModels(snapshot => snapshot)
  const readiness = onboardingReadiness(state)
  const [skipped, setSkipped] = useState<boolean | undefined>(undefined)

  // Persist the dismissal and end the step either way: completing after a
  // saved key is equally fine (readiness keeps the step closed thereafter).
  const finish = useCallback((): void => {
    void api.settings.mutate({
      ns: WELCOME_NOTICE_SETTINGS_NAMESPACE,
      ops: [{ op: 'set', path: [DEEPSEEK_ONBOARDING_SKIP_FIELD], value: DEEPSEEK_ONBOARDING_SKIP_VALUE }],
    }).then(() => complete()).catch(() => complete())
  }, [api, complete])

  // Dismissal is durable (ui-onboarding settings): a user who skipped once is
  // never blocked by this modal again, not even after a reload or restart.
  // The memory-only step-completion ledger in the settings shell resets with
  // the page, which is why persistence lives here, at the step itself.
  useEffect(() => {
    let alive = true
    void api.settings.describe({}).then((response) => {
      if (!response.result.ok || !alive) return
      const ns = response.result.value.namespaces.find(candidate => candidate.ns === WELCOME_NOTICE_SETTINGS_NAMESPACE)
      const value = ns?.value as Record<string, unknown> | undefined
      if (value?.[DEEPSEEK_ONBOARDING_SKIP_FIELD] === DEEPSEEK_ONBOARDING_SKIP_VALUE) {
        setSkipped(true)
        complete()
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [api, complete])

  useEffect(() => {
    if (state.status === 'idle') void controller.load()
  }, [controller, state.status])

  useEffect(() => {
    if (
      readiness.kind === 'adapter-absent'
      || readiness.kind === 'provider-ready'
      || readiness.kind === 'unavailable'
    ) finish()
  }, [finish, readiness.kind])

  if (skipped === true) return null

  switch (readiness.kind) {
    case 'loading':
    case 'adapter-absent':
    case 'provider-ready':
    case 'unavailable':
      return null
    case 'credential-missing':
      break
    /* v8 ignore next -- every current readiness variant is handled above */
    default:
      return assertNever(readiness)
  }

  const row = state.rows.find(candidate =>
    candidate.entry.provider === 'deepseek-official'
    && candidate.entry.settingsNs === 'llm-deepseek'
    && candidate.entry.settingsPath.length === 0)
  const namespace = state.namespaces.get('llm-deepseek')
  /* v8 ignore next 2 -- credential-missing is derived only from this exact joined row. */
  if (row === undefined || namespace === undefined) return null

  const finishCredential = (changed: boolean): void => {
    if (!changed) {
      finish()
      return
    }
    void controller.load()
  }

  return (
    <OnboardingModal title={t('onboardingTitle')}>
      <p className={styles.description}>{t('onboardingDescription')}</p>
      <div className={styles.editor}>
        <ProviderEditor
          provider={row.entry.provider}
          displayName={row.entry.displayName}
          namespace={namespace}
          settingsPath={row.entry.settingsPath}
          api={api}
          t={t}
          readOnly={false}
          hideTitle
          credentialOnly
          credentialRequired
          autoFocusCredential
          cancelLabel="onboardingLater"
          submitLabel="onboardingSave"
          submitBusyLabel="onboardingSaving"
          onClose={finishCredential}
        />
      </div>
    </OnboardingModal>
  )
}
