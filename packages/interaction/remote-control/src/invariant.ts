/** Package-owned invariant companion for the remote-control bridge. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-remote-control'

export const name = 'remote-control-invariant'
export const inject = ['invariants']

/** No runtime invariant: the service owns one Host and one private state file with no second authority. */
const install: InvariantInstaller = Object.assign(() => {}, { inject: ['remoteControl'] })

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
