/** Desktop-only application-update section registration. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { DesktopUpdateRow, type DesktopUpdateRowInjected } from './DesktopUpdateRow.tsx'
import { DesktopUpdateController } from './update-controller.ts'
import { en, zh } from './locales.ts'

export type { DesktopUpdateRowInjected, DesktopUpdateRowProps } from './DesktopUpdateRow.tsx'
export type { DesktopUpdateKey } from './locales.ts'
export type { DesktopUpdatePhase, DesktopUpdateState } from './update-controller.ts'
export { DesktopUpdateController, parseDesktopUpdateState } from './update-controller.ts'

/** Services required by the browser half. */
export const inject = ['slots', 'locale']

/** Locale namespace owned by the update section. */
export const SETTINGS_NS = 'settings.desktop-update'

/**
 * Register the private-protocol update controller as a settings section.
 * @param ctx - desktop client context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(SETTINGS_NS, { zh, en }),
    'ui-desktop-update: settings section dictionaries',
  )
  const controller = new DesktopUpdateController()
  const injected = (): DesktopUpdateRowInjected => ({
    hooks: { update: controller.store },
    load: () => controller.load(),
    check: () => controller.check(),
    update: () => controller.update(),
    install: () => controller.install(),
    setAutomaticChecks: enabled => controller.setAutomaticChecks(enabled),
  })
  ctx.effect(() => () => { controller.dispose() }, 'ui-desktop-update: controller lifecycle')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'desktop-update',
    order: 50,
    label: () => ctx.locale.bind(SETTINGS_NS)('nav'),
    locale: SETTINGS_NS,
    inject: injected,
  }, DesktopUpdateRow))
}
