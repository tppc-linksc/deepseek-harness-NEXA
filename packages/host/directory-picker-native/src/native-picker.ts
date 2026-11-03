/** Cross-platform native single-directory chooser behind the native backend's capability. */

import { runNativeCommand, type NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import { pickWin32Directory } from './win32-dialog.ts'

/** Testable command boundary; native implementations never invoke a shell. */
export type DirectoryPickerRunner = NativeCommandRunner

/** Injectable platform facts for deterministic adapter tests. */
export interface DirectoryPickerInternals {
  platform?: NodeJS.Platform
  run?: DirectoryPickerRunner
  /** Replaces the in-process Win32 dialog (`pickWin32Directory`) for deterministic tests. */
  pickWin32Dialog?: (signal: AbortSignal) => Promise<string | null>
}

function outputPath(stdout: string): string | null {
  const path = stdout.replace(/[\r\n]+$/, '')
  return path === '' ? null : path
}

function errorCode(error: unknown): string | number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' || typeof code === 'number' ? code : undefined
}

function errorStderr(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('stderr' in error)) return ''
  const stderr = (error as { stderr?: unknown }).stderr
  return typeof stderr === 'string' ? stderr : ''
}

function isMissingCommand(error: unknown): boolean {
  return errorCode(error) === 'ENOENT'
}

function rethrowIfAborted(signal: AbortSignal, error: unknown): void {
  if (signal.aborted) throw error
}

/** The macOS chooser's dialog can be blocked before it ever opens (automation
 * permission denied, headless session): cap the wait so a dead osascript
 * surfaces a real error instead of hanging the pick forever. */
const DARWIN_CHOOSER_TIMEOUT_MS = 60_000

/** The stall timeout aborts the osascript child with Node's ABORT_ERR. */
function isStalled(error: unknown): boolean {
  return errorCode(error) === 'ABORT_ERR'
}

/** Combine the caller's abort with a hard stall timeout. Implemented with a
 * local controller instead of AbortSignal.any: the composed signal is handed
 * to execFile, and the composed abort must also fire when the timeout alone
 * expires (AbortSignal.any semantics), without leaking a live timer into the
 * caller's lifetime (the timeout is unref'd). */
function darwinSignal(signal: AbortSignal): AbortSignal {
  const controller = new AbortController()
  if (signal.aborted) {
    controller.abort(signal.reason)
    return controller.signal
  }
  const onAbort = (): void => { controller.abort(signal.reason) }
  signal.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), DARWIN_CHOOSER_TIMEOUT_MS)
  timer.unref?.()
  return controller.signal
}

/**
 * Open the platform directory picker.
 * @param signal - caller/connection lifetime; abort terminates the native command.
 * @param internals - Platform and runner hooks for deterministic tests.
 * @returns the selected path, or null when the user cancels.
 */
export async function pickNativeDirectory(
  signal: AbortSignal,
  internals: DirectoryPickerInternals = {},
): Promise<string | null> {
  const platform = internals.platform ?? process.platform
  const run = internals.run ?? runNativeCommand

  if (platform === 'darwin') {
    console.log('TRACE darwin signal.aborted =', signal.aborted)
    try {
      const merged = darwinSignal(signal)
      console.log('TRACE merged.aborted =', merged.aborted)
      const result = await run('osascript', [
        '-e', 'set selectedFolder to choose folder with prompt "Select Workspace Directory"',
        '-e', 'POSIX path of selectedFolder',
      ], merged)
      return outputPath(result.stdout)
    } catch (error: unknown) {
      if (!signal.aborted && errorCode(error) === 1
        && /(?:User canceled|-128)/i.test(errorStderr(error))) return null
      if (!signal.aborted && isStalled(error)) {
        throw new Error('the macOS directory chooser did not respond (automation permission may be missing); '
          + 'grant DeepSeek Harness access in System Settings > Privacy & Security > Automation, or use the browser GUI')
      }
      throw error
    }
  }

  if (platform === 'win32') {
    // The koffi-backed IFileOpenDialog child process — the modern picker with
    // per-monitor-v2 DPI and abort support. koffi is a packaged dependency
    // whose availability the install guarantees, so there is no fallback
    // tier: any failure surfaces as-is (no PowerShell fallback tier; see
    // .agents/notes/implemented/simplification/2026-08-04-drop-windows-powershell-picker-fallback.md).
    const pickDialog = internals.pickWin32Dialog ?? pickWin32Directory
    return await pickDialog(signal)
  }

  if (platform === 'linux') {
    try {
      const result = await run('zenity', [
        '--file-selection', '--directory', '--title=Select Workspace Directory',
      ], signal)
      return outputPath(result.stdout)
    } catch (error: unknown) {
      rethrowIfAborted(signal, error)
      if (errorCode(error) === 1) return null
      if (!isMissingCommand(error)) throw error
    }

    try {
      const result = await run('kdialog', [
        '--getexistingdirectory', '.', '--title', 'Select Workspace Directory',
      ], signal)
      return outputPath(result.stdout)
    } catch (error: unknown) {
      rethrowIfAborted(signal, error)
      if (errorCode(error) === 1) return null
      if (isMissingCommand(error)) {
        throw new Error('no supported native directory picker found (install zenity or kdialog)')
      }
      throw error
    }
  }

  throw new Error(`native directory picker is unsupported on ${platform}`)
}
