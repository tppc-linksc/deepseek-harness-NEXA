/** Package invariant companion for the desktop update surface. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-desktop-update'

/** Cordis companion plugin name. */
export const name = 'client-ui-desktop-update-invariant'
/** Service required before package ownership can be reserved. */
export const inject = ['invariants']

/** Renderer state is validated at the private protocol response parser. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant registry.
 * @returns the installed registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
