/** Package-owned invariant companion for the Remote Control settings surface. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-remote-control'

export const name = 'ui-remote-control-invariant'
export const inject = ['invariants']

/** No runtime invariant: the UI controller owns no durable state or independent event history. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
