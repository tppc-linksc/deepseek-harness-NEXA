import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { Context } from '@deepseek-ai/cordis'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type {
  SubprocessHandle,
  SubprocessOutcome,
  SubprocessSpawnSpec,
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import { describe, expect, it } from 'vitest'
import {
  desktopMarketBootstrap,
  DesktopPnpmService,
  DesktopProfilesService,
  type DesktopMarketBootstrap,
} from '../src/desktop-market-services.ts'

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  return { promise: new Promise<T>((settle) => { resolve = settle }), resolve }
}

class CapturingSubprocessRuntime extends SubprocessRuntime {
  readonly specs: SubprocessSpawnSpec[] = []
  readonly processDone = deferred<SubprocessOutcome>()
  readonly treeDone = deferred<boolean>()
  terminated = 0

  async resolveExecutable(command: string): Promise<string> {
    return command
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.specs.push(spec)
    return {
      pid: 42,
      stdin: undefined,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      collected: {},
      done: this.processDone.promise,
      terminate: () => { this.terminated += 1 },
      waitForExit: () => this.treeDone.promise,
    }
  }

  async spawnTerminal(_spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle> {
    throw new Error('terminal allocation is not used by desktop package operations')
  }
}

function fixture(): { readonly root: string; readonly bootstrap: DesktopMarketBootstrap } {
  const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-market-'))
  return {
    root,
    bootstrap: {
      profileDir: join(root, 'runtime', 'profiles', 'desktop'),
      homeDir: join(root, 'runtime'),
      commandRuntimeDir: join(root, 'commands'),
      appExecutable: join(root, 'DeepSeek NEXA'),
      dshBinPath: join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
      pnpmBinPath: join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      electronVersion: '43.4.0',
    },
  }
}

describe('desktop community-market services', () => {
  it('requires complete absolute launcher inputs', () => {
    expect(() => desktopMarketBootstrap({})).toThrow('DSH_DESKTOP_PROFILE_DIR is required')
    expect(() => desktopMarketBootstrap({ DSH_DESKTOP_PROFILE_DIR: 'relative' }))
      .toThrow('must be an absolute path')
  })

  it('publishes one immutable desktop profile identity', () => {
    const ctx = new Context()
    const service = new DesktopProfilesService(ctx, '/desktop/profile')
    expect(ctx.desktopProfiles.current).toBe(service.current)
    expect(service.current).toEqual({ name: 'desktop', dir: '/desktop/profile' })
    expect(Object.isFrozen(service.current)).toBe(true)
  })

  it('runs official plugin commands inside the independent desktop profile environment', async () => {
    const { root, bootstrap } = fixture()
    try {
      const ctx = new Context()
      const subprocess = new CapturingSubprocessRuntime(ctx)
      const service = new DesktopPnpmService(ctx, bootstrap)
      const operation = service.runPlugin(['install', 'dsh-plugin-example'], join(root, 'workspace'))
      const spec = subprocess.specs[0]!

      expect(spec.argv).toEqual([
        bootstrap.appExecutable,
        '--import',
        expect.stringMatching(/^file:/),
        bootstrap.dshBinPath,
        'plugin',
        '--profile',
        'desktop',
        'install',
        'dsh-plugin-example',
      ])
      expect(spec.cwd).toBe(join(root, 'workspace'))
      expect(spec.env).toMatchObject({
        ELECTRON_RUN_AS_NODE: '1',
        DSH_HOME: bootstrap.homeDir,
        CI: 'true',
        npm_config_runtime: 'electron',
        npm_config_target: '43.4.0',
        npm_config_disturl: 'https://electronjs.org/headers',
      })
      expect(spec.env?.PATH).toContain(join(bootstrap.commandRuntimeDir, 'bin'))
      expect(spec.env?.NODE).toContain(join(bootstrap.commandRuntimeDir, 'bin'))

      const nodeShim = join(bootstrap.commandRuntimeDir, 'bin', process.platform === 'win32' ? 'node.cmd' : 'node')
      expect(readFileSync(nodeShim, 'utf8')).toContain(bootstrap.appExecutable)
      if (process.platform !== 'win32') expect(statSync(nodeShim).mode & 0o700).toBe(0o700)

      subprocess.processDone.resolve({ exitCode: 0, signal: null })
      await Promise.resolve()
      expect(() => service.runPlugin(['update', 'dsh-plugin-example'], root))
        .toThrow('another desktop pnpm operation is already running')
      subprocess.treeDone.resolve(true)
      await expect(operation.done).resolves.toEqual({ exitCode: 0, signal: null })
    } finally {
      chmodSync(root, 0o700)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('forwards cancellation to the managed process tree', () => {
    const { root, bootstrap } = fixture()
    try {
      const ctx = new Context()
      const subprocess = new CapturingSubprocessRuntime(ctx)
      const service = new DesktopPnpmService(ctx, bootstrap)
      const operation = service.run(['list'])
      operation.cancel()
      expect(subprocess.terminated).toBe(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
