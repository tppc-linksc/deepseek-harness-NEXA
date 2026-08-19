/** Desktop profile and package-manager services consumed by community market plugins. */

import {
  chmodSync,
  lstatSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import type { Readable } from 'node:stream'

const ELECTRON_HEADERS_URL = 'https://electronjs.org/headers'
const TERMINATION_GRACE_MS = 3_000
const PROFILE_NAME = 'desktop'

/** Immutable profile identity exposed to desktop-aware plugins. */
export interface DesktopCurrentProfile {
  /** Profile name passed to the official DSH CLI. */
  readonly name: typeof PROFILE_NAME
  /** Absolute directory containing the desktop profile manifest. */
  readonly dir: string
}

/** Structural service consumed by community desktop plugins. */
export interface DesktopProfiles {
  /** Profile backing the active Cordis generation. */
  readonly current: DesktopCurrentProfile
}

/** Streaming result returned to a community package-management plugin. */
export interface DesktopPnpmHandle {
  /** Standard output emitted by DSH and pnpm. */
  readonly stdout: Readable
  /** Standard error emitted by DSH and pnpm. */
  readonly stderr: Readable
  /** Exit facts after the complete process tree has stopped. */
  readonly done: Promise<SubprocessOutcome>
  /** Begin termination of the complete operation process tree. */
  cancel(): void
}

/** Launcher-owned inputs for the portless desktop market services. */
export interface DesktopMarketBootstrap {
  /** Absolute directory containing the active desktop profile. */
  readonly profileDir: string
  /** Harness home containing the desktop profile and settings. */
  readonly homeDir: string
  /** Private directory receiving Electron-backed command shims. */
  readonly commandRuntimeDir: string
  /** Electron application executable reused through RunAsNode. */
  readonly appExecutable: string
  /** Physical JavaScript entry for the packaged DSH CLI. */
  readonly dshBinPath: string
  /** Physical JavaScript entry for the packaged pnpm release. */
  readonly pnpmBinPath: string
  /** Electron version used when pnpm installs native dependencies. */
  readonly electronVersion: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Active profile identity exposed to desktop-aware plugins. */
    desktopProfiles: DesktopProfiles
    /** Package operations scoped to the active desktop profile. */
    desktopPnpm: DesktopPnpmService
  }
}

/**
 * Read and validate launcher inputs supplied by Electron main.
 * @param environment - process environment carrying absolute desktop runtime paths.
 * @returns immutable inputs for the desktop market services.
 */
export function desktopMarketBootstrap(environment: NodeJS.ProcessEnv = process.env): DesktopMarketBootstrap {
  const bootstrap = {
    profileDir: requiredAbsoluteEnvironment(environment, 'DSH_DESKTOP_PROFILE_DIR'),
    homeDir: requiredAbsoluteEnvironment(environment, 'DSH_HOME'),
    commandRuntimeDir: requiredAbsoluteEnvironment(environment, 'DSH_DESKTOP_COMMAND_RUNTIME'),
    appExecutable: requiredAbsoluteEnvironment(environment, 'DSH_DESKTOP_APP_EXECUTABLE'),
    dshBinPath: requiredAbsoluteEnvironment(environment, 'DSH_DESKTOP_CLI_BIN'),
    pnpmBinPath: requiredAbsoluteEnvironment(environment, 'DSH_DESKTOP_PNPM_BIN'),
    electronVersion: environment.DSH_DESKTOP_ELECTRON_VERSION ?? '',
  }
  if (bootstrap.electronVersion.length === 0 || bootstrap.electronVersion.includes('\0')) {
    throw new Error('desktop-app: DSH_DESKTOP_ELECTRON_VERSION must not be empty or contain NUL')
  }
  return bootstrap
}

/** Profile service fixed for one UtilityProcess generation. */
export class DesktopProfilesService extends Service implements DesktopProfiles {
  readonly current: DesktopCurrentProfile

  /**
   * Register the immutable desktop profile identity.
   * @param ctx - Host context receiving the service.
   * @param profileDir - absolute desktop profile directory.
   */
  constructor(ctx: Context, profileDir: string) {
    assertAbsolutePath('profile directory', profileDir)
    super(ctx, 'desktopProfiles')
    this.current = Object.freeze({ name: PROFILE_NAME, dir: profileDir })
  }
}

/** Package-manager service that runs one official DSH plugin operation at a time. */
export class DesktopPnpmService extends Service {
  private active: SubprocessHandle | undefined
  private closed = false
  private readonly nodeBinDir: string
  private readonly clearEnvironmentPath: string

  /**
   * Register package operations for the immutable desktop profile generation.
   * @param ctx - Host context providing the managed subprocess service.
   * @param bootstrap - validated launcher paths and Electron version.
   */
  constructor(ctx: Context, private readonly bootstrap: DesktopMarketBootstrap) {
    validateBootstrap(bootstrap)
    super(ctx, 'desktopPnpm')
    const runtime = prepareCommandRuntime(bootstrap)
    this.nodeBinDir = runtime.nodeBinDir
    this.clearEnvironmentPath = runtime.clearEnvironmentPath
    ctx.effect(() => async () => {
      this.closed = true
      const active = this.active
      if (active === undefined) return
      active.terminate()
      await active.waitForExit()
    }, 'desktop-app: package operation teardown')
  }

  /**
   * Run packaged pnpm directly in the active desktop profile.
   * @param args - pnpm arguments following its JavaScript entry.
   * @param signal - optional operation cancellation.
   * @returns live output streams and completion.
   */
  run(args: readonly string[], signal?: AbortSignal): DesktopPnpmHandle {
    return this.start([
      this.bootstrap.appExecutable,
      '--import',
      pathToFileURL(this.clearEnvironmentPath).href,
      this.bootstrap.pnpmBinPath,
      ...validatedArgs(args),
    ], this.bootstrap.profileDir, signal)
  }

  /**
   * Run the official `dsh plugin` command against the desktop profile.
   * @param args - plugin subcommand arguments supplied by the market.
   * @param invokingDir - absolute directory anchoring relative package specifications.
   * @param signal - optional operation cancellation.
   * @returns live output streams and completion.
   */
  runPlugin(args: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle {
    assertAbsolutePath('plugin invoking directory', invokingDir)
    return this.start([
      this.bootstrap.appExecutable,
      '--import',
      pathToFileURL(this.clearEnvironmentPath).href,
      this.bootstrap.dshBinPath,
      'plugin',
      '--profile',
      PROFILE_NAME,
      ...validatedArgs(args),
    ], invokingDir, signal)
  }

  private start(argv: readonly string[], cwd: string, signal?: AbortSignal): DesktopPnpmHandle {
    if (this.closed) throw new Error('desktop-app: desktop pnpm service is disposed')
    if (this.active !== undefined) throw new Error('desktop-app: another desktop pnpm operation is already running')
    const child = this.ctx.subprocess.spawn({
      argv,
      cwd,
      stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
      graceMs: TERMINATION_GRACE_MS,
      ...(signal === undefined ? {} : { signal }),
      env: this.childEnvironment(),
    })
    if (child.stdout === undefined || child.stderr === undefined) {
      child.terminate()
      throw new Error('desktop-app: package operation did not expose piped output')
    }
    this.active = child
    const done = child.done.then(async (outcome) => {
      await child.waitForExit()
      if (this.active === child) this.active = undefined
      return outcome
    }, async (error: unknown) => {
      await child.waitForExit()
      if (this.active === child) this.active = undefined
      throw error
    })
    return {
      stdout: child.stdout,
      stderr: child.stderr,
      done,
      cancel: () => { child.terminate() },
    }
  }

  private childEnvironment(): NodeJS.ProcessEnv {
    return {
      PATH: `${this.nodeBinDir}${delimiter}${inheritedPath()}`,
      NODE: join(this.nodeBinDir, process.platform === 'win32' ? 'node.cmd' : 'node'),
      ELECTRON_RUN_AS_NODE: '1',
      DSH_HOME: this.bootstrap.homeDir,
      CI: 'true',
      npm_config_runtime: 'electron',
      npm_config_target: this.bootstrap.electronVersion,
      npm_config_disturl: ELECTRON_HEADERS_URL,
    }
  }
}

/**
 * Register the two desktop-aware services required by the community market.
 * @param ctx - Host context receiving the profile and package-operation services.
 * @param bootstrap - validated desktop launcher inputs.
 */
export function installDesktopMarketServices(ctx: Context, bootstrap = desktopMarketBootstrap()): void {
  new DesktopProfilesService(ctx, bootstrap.profileDir)
  new DesktopPnpmService(ctx, bootstrap)
}

/** Resolve one required absolute launcher environment value. */
function requiredAbsoluteEnvironment(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]
  if (value === undefined) throw new Error(`desktop-app: ${name} is required`)
  assertAbsolutePath(name, value)
  return value
}

/** Reject unsafe or unresolved paths before they cross a process boundary. */
function assertAbsolutePath(label: string, value: string): void {
  if (value.length === 0 || value.includes('\0') || !isAbsolute(value)) {
    throw new Error(`desktop-app: ${label} must be an absolute path without NUL`)
  }
}

/** Validate the complete immutable bootstrap before publishing the service. */
function validateBootstrap(bootstrap: DesktopMarketBootstrap): void {
  for (const [label, value] of [
    ['profile directory', bootstrap.profileDir],
    ['Harness home', bootstrap.homeDir],
    ['command runtime directory', bootstrap.commandRuntimeDir],
    ['application executable', bootstrap.appExecutable],
    ['DSH CLI entry', bootstrap.dshBinPath],
    ['pnpm entry', bootstrap.pnpmBinPath],
  ] as const) assertAbsolutePath(label, value)
  if (bootstrap.electronVersion.length === 0 || bootstrap.electronVersion.includes('\0')) {
    throw new Error('desktop-app: Electron version must not be empty or contain NUL')
  }
}

/** Reject an empty or NUL-bearing argv list. */
function validatedArgs(args: readonly string[]): string[] {
  if (args.length === 0) throw new Error('desktop-app: package operation arguments must not be empty')
  if (args.some(argument => argument.includes('\0'))) {
    throw new Error('desktop-app: package operation arguments must not contain NUL')
  }
  return [...args]
}

/** Read PATH with Windows-compatible environment-name matching. */
function inheritedPath(): string {
  if (process.env.PATH !== undefined || process.platform !== 'win32') return process.env.PATH ?? ''
  return Object.entries(process.env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? ''
}

interface CommandRuntime {
  readonly nodeBinDir: string
  readonly clearEnvironmentPath: string
}

/** Materialize private shims that let Electron execute Node and pnpm entries. */
function prepareCommandRuntime(bootstrap: DesktopMarketBootstrap): CommandRuntime {
  const nodeBinDir = join(bootstrap.commandRuntimeDir, 'bin')
  mkdirSync(nodeBinDir, { recursive: true, mode: 0o700 })
  chmodSync(bootstrap.commandRuntimeDir, 0o700)
  chmodSync(nodeBinDir, 0o700)
  const clearEnvironmentPath = join(bootstrap.commandRuntimeDir, 'clear-electron-run-as-node.mjs')
  writePrivateFile(clearEnvironmentPath, 'delete process.env.ELECTRON_RUN_AS_NODE\n')
  const clearUrl = pathToFileURL(clearEnvironmentPath).href
  if (process.platform === 'win32') {
    writePrivateFile(join(nodeBinDir, 'node.cmd'), windowsShim(bootstrap.appExecutable, ['--import', clearUrl]))
    writePrivateFile(join(nodeBinDir, 'pnpm.cmd'), windowsShim(bootstrap.appExecutable, [
      '--import', clearUrl, bootstrap.pnpmBinPath,
    ]))
  } else {
    writePrivateFile(join(nodeBinDir, 'node'), posixShim(bootstrap.appExecutable, ['--import', clearUrl]))
    writePrivateFile(join(nodeBinDir, 'pnpm'), posixShim(bootstrap.appExecutable, [
      '--import', clearUrl, bootstrap.pnpmBinPath,
    ]))
  }
  return { nodeBinDir, clearEnvironmentPath }
}

/** Write one command-runtime file after rejecting symbolic links and non-files. */
function writePrivateFile(path: string, content: string): void {
  try {
    const existing = lstatSync(path)
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error(`desktop-app: command runtime path is not a regular file: ${JSON.stringify(path)}`)
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw error
  }
  writeFileSync(path, content, { encoding: 'utf8', mode: 0o700, flag: 'w' })
  chmodSync(path, 0o700)
}

/** Build a POSIX launcher without shell-interpreting any path. */
function posixShim(executable: string, fixedArgs: readonly string[]): string {
  const command = [executable, ...fixedArgs].map(posixQuote).join(' ')
  return `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${command} "$@"\n`
}

/** Quote one POSIX shell argument as a literal. */
function posixQuote(value: string): string {
  const escapedSingleQuote = String.fromCharCode(39, 34, 39, 34, 39)
  return `'${value.replaceAll('\'', escapedSingleQuote)}'`
}

/** Build a Windows command launcher with delayed expansion disabled. */
function windowsShim(executable: string, fixedArgs: readonly string[]): string {
  const command = [executable, ...fixedArgs].map(windowsQuote).join(' ')
  return `@echo off\r\n@setlocal DisableDelayedExpansion\r\n@set ELECTRON_RUN_AS_NODE=1\r\n@${command} %*\r\n`
}

/** Quote one Windows command argument and escape environment expansion. */
function windowsQuote(value: string): string {
  return `"${value.replaceAll('%', '%%').replaceAll('"', '\\"')}"`
}
