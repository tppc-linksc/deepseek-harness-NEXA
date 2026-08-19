/** Resolve command entrypoints shipped inside the desktop application. */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

/** Resolve the pnpm CLI without requesting a package subpath hidden by pnpm exports. */
export function resolveBundledPnpmBin(
  resolvePackage: (specifier: string) => string = require.resolve,
): string {
  const pnpmPackageEntry = resolvePackage('pnpm')
  const pnpmBin = join(dirname(pnpmPackageEntry), 'bin', 'pnpm.mjs')
  if (!existsSync(pnpmBin)) throw new Error(`bundled pnpm CLI is missing: ${pnpmBin}`)
  return pnpmBin
}
