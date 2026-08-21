/** Remote Control settings registration. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { RemoteControlController } from './controller.ts'
import { RemoteControlSection, type RemoteControlSectionInjected } from './RemoteControlSection.tsx'
import { en, zh, type RemoteControlLocaleKey } from './locales.ts'

export type { RemoteControlView, RemoteControlRemote } from './controller.ts'
export { RemoteControlController } from './controller.ts'
export type { RemoteControlSectionInjected, RemoteControlSectionProps } from './RemoteControlSection.tsx'
export type { RemoteControlLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.remote-control': RemoteControlLocaleKey
  }
}

/** Locale namespace owned by the Remote Control settings contribution. */
export const NS = 'settings.remote-control'
export const inject = ['slots', 'locale', 'remote', 'remote.remoteControl']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-remote-control: dictionaries')
  const controller = new RemoteControlController(ctx.remote.remoteControl)
  const injected = (): RemoteControlSectionInjected => ({
    hooks: { remoteControl: controller.store },
    load: () => controller.load(),
    configure: request => controller.configure(request),
    reconnect: () => controller.reconnect(),
    openPairing: () => controller.openPairing(),
    confirmPairing: () => controller.confirmPairing(),
    revoke: deviceId => controller.revoke(deviceId),
  })
  ctx.effect(() => () => { controller.dispose() }, 'ui-remote-control: controller lifecycle')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'remote-control',
    order: 40,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: injected,
  }, RemoteControlSection))
}
