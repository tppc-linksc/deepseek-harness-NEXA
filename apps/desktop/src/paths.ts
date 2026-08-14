/** Desktop-owned storage paths and utility-process environment. */

import { join } from 'node:path'

/** Runtime paths owned exclusively by the desktop application. */
export interface DesktopPaths {
  /** Electron Chromium state and the parent directory for every desktop runtime file. */
  readonly userData: string
  /** Harness home passed to the utility process as `DSH_HOME`. */
  readonly runtime: string
  /** Agent configuration root passed to the utility process as `DSH_AGENTS_HOME`. */
  readonly agents: string
  /** Directory receiving utility-process output. */
  readonly logs: string
}

/**
 * Resolve the desktop namespace below Electron's platform application-data root.
 * @param appData - value returned by Electron `app.getPath('appData')`.
 * @returns desktop-owned Chromium, Harness, agent, and log paths.
 */
export function resolveDesktopPaths(appData: string): DesktopPaths {
  const userData = join(appData, 'DeepSeek Harness', 'desktop')
  const runtime = join(userData, 'runtime')
  return {
    userData,
    runtime,
    agents: join(runtime, 'agents'),
    logs: join(userData, 'logs'),
  }
}

/**
 * Build the utility-process environment with desktop-owned writable roots.
 * @param source - Electron main's inherited environment.
 * @param paths - resolved desktop runtime paths.
 * @returns a fresh environment for the Harness utility process.
 */
export function desktopHostEnvironment(source: NodeJS.ProcessEnv, paths: DesktopPaths): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
  delete environment.DSH_WEB_URL
  environment.DSH_HOME = paths.runtime
  environment.DSH_AGENTS_HOME = paths.agents
  // The unofficial desktop distribution never exports session telemetry,
  // even when its parent process inherited an opt-in mode.
  environment.DSH_TELEMETRY_DISABLED = '1'
  // Electron intentionally rejects --expose-internals in packaged apps, so
  // Cordis configuration HMR cannot run in the distributed UtilityProcess.
  environment.DSH_DESKTOP_HOST = '1'
  return environment
}
