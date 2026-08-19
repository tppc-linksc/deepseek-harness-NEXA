/** Validate platform-native files before packaging the deployed desktop runtime. */

import { chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** Operating-system target supported by the desktop installer pipeline. */
export type DesktopTarget = 'linux' | 'mac' | 'win'
/** CPU architecture supported by the desktop installer pipeline. */
export type DesktopArch = 'arm64' | 'x64'

function assertFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`deployed ${label} is missing: ${path}`)
}

/**
 * Reject a deployed desktop closure that lacks native files used on its target platform.
 * @param staging - Root of the pnpm-deployed desktop application.
 * @param target - Installer operating-system target.
 * @param arch - Installer CPU architecture.
 */
export function validateDesktopNativePayload(
  staging: string,
  target: DesktopTarget,
  arch: DesktopArch,
): void {
  const modules = join(staging, 'node_modules')
  if (target === 'mac') {
    const prebuild = join(modules, 'node-pty', 'prebuilds', `darwin-${arch}`)
    const helper = join(prebuild, 'spawn-helper')
    assertFile(join(prebuild, 'pty.node'), `node-pty darwin-${arch} addon`)
    assertFile(helper, `node-pty darwin-${arch} spawn helper`)
    chmodSync(helper, 0o755)
    return
  }

  if (target === 'win') {
    const prebuild = join(modules, 'node-pty', 'prebuilds', `win32-${arch}`)
    for (const [path, label] of [
      [join(prebuild, 'conpty.node'), `node-pty win32-${arch} ConPTY addon`],
      [join(prebuild, 'conpty_console_list.node'), `node-pty win32-${arch} console-list addon`],
      [join(prebuild, 'conpty', 'conpty.dll'), `node-pty win32-${arch} ConPTY library`],
      [join(prebuild, 'conpty', 'OpenConsole.exe'), `node-pty win32-${arch} OpenConsole helper`],
    ] as const) {
      assertFile(path, label)
    }
    return
  }

  const candidates = [
    join(modules, 'node-pty', 'build', 'Release', 'pty.node'),
    join(modules, 'node-pty', 'prebuilds', `linux-${arch}`, 'pty.node'),
  ]
  if (!candidates.some(existsSync)) {
    throw new Error(`deployed node-pty linux-${arch} addon is missing: ${candidates.join(' or ')}`)
  }
}
