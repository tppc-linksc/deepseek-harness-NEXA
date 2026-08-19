import { describe, expect, it } from 'vitest'
import { desktopHostEnvironment, resolveDesktopPaths } from '../src/paths.ts'

describe('desktop runtime paths', () => {
  it('keeps Chromium state, Harness state, agents, and logs in one desktop namespace', () => {
    const paths = resolveDesktopPaths('/application-data')
    expect(paths).toEqual({
      userData: '/application-data/DeepSeek Harness/desktop',
      runtime: '/application-data/DeepSeek Harness/desktop/runtime',
      agents: '/application-data/DeepSeek Harness/desktop/runtime/agents',
      logs: '/application-data/DeepSeek Harness/desktop/logs',
      updates: '/application-data/DeepSeek Harness/desktop/updates',
      profile: '/application-data/DeepSeek Harness/desktop/runtime/profiles/desktop',
      commandRuntime: '/application-data/DeepSeek Harness/desktop/commands',
    })
  })

  it('overrides ambient Harness roots and removes stale Web surface context', () => {
    const paths = resolveDesktopPaths('/application-data')
    expect(desktopHostEnvironment({
      DSH_HOME: '/web/home',
      DSH_AGENTS_HOME: '/web/agents',
      DSH_WEB_URL: 'http://127.0.0.1:3456',
      DSH_TELEMETRY_DISABLED: '0',
      DEEPSEEK_API_KEY: 'preserved',
    }, paths, {
      appExecutable: '/Applications/DeepSeek NEXA.app/Contents/MacOS/DeepSeek NEXA',
      dshBin: '/app/node_modules/@deepseek-ai/dsh/lib/bin.js',
      pnpmBin: '/app/node_modules/pnpm/bin/pnpm.mjs',
      electronVersion: '43.4.0',
    })).toEqual({
      DSH_HOME: paths.runtime,
      DSH_AGENTS_HOME: paths.agents,
      DSH_DESKTOP_HOST: '1',
      DSH_TELEMETRY_DISABLED: '1',
      DSH_DESKTOP_PROFILE_DIR: paths.profile,
      DSH_DESKTOP_COMMAND_RUNTIME: paths.commandRuntime,
      DSH_DESKTOP_APP_EXECUTABLE: '/Applications/DeepSeek NEXA.app/Contents/MacOS/DeepSeek NEXA',
      DSH_DESKTOP_CLI_BIN: '/app/node_modules/@deepseek-ai/dsh/lib/bin.js',
      DSH_DESKTOP_PNPM_BIN: '/app/node_modules/pnpm/bin/pnpm.mjs',
      DSH_DESKTOP_ELECTRON_VERSION: '43.4.0',
      DEEPSEEK_API_KEY: 'preserved',
    })
  })
})
