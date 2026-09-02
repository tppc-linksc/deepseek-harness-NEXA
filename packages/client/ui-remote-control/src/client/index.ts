/** Remote Control sidebar-action registration. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { RemoteControlController } from './controller.ts'
import { RemoteControlAction, type RemoteControlActionInjected } from './RemoteControlAction.tsx'
import { en, zh, type RemoteControlLocaleKey } from './locales.ts'

export type { RemoteControlView, RemoteControlRemote } from './controller.ts'
export { RemoteControlController } from './controller.ts'
export type { RemoteControlActionInjected, RemoteControlActionProps } from './RemoteControlAction.tsx'
export type { RemoteControlLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'remote-control': RemoteControlLocaleKey
  }
}

/** Locale namespace owned by the Remote Control sidebar contribution. */
export const NS = 'remote-control'
export const inject = ['slots', 'locale', 'remote', 'remote.remoteControl', 'sessions']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-remote-control: dictionaries')
  const controller = new RemoteControlController(ctx.remote.remoteControl)
  const injected = (): RemoteControlActionInjected => ({
    hooks: { remoteControl: controller.store },
    load: () => controller.load(),
    setEnabled: enabled => controller.configure({
      ...controller.store.getSnapshot().state.preferences,
      enabled,
    }),
    openPairing: () => controller.openPairing(),
  })
  ctx.effect(() => () => { controller.dispose() }, 'ui-remote-control: controller lifecycle')
  ctx.effect(
    () => ctx.remote.$on(
      'remote-control/session-created',
      (sessionId) => {
        // The carrier event can reach the browser before the Session list
        // notification. Refreshing first preserves open()'s listed-id
        // precondition for phone-created blank sessions.
        void ctx.sessions.refresh()
          .then(() => { ctx.sessions.open(sessionId as SessionId) })
          .catch(() => undefined)
      },
    ),
    'ui-remote-control: open sessions created from mobile',
  )
  ctx.slots.inject('sidebar.footer.trailing', () => ctx.slots.register({
    name: 'sidebar.footer.trailing',
    id: 'remote-control',
    order: 80,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: injected,
  }, RemoteControlAction))
}
