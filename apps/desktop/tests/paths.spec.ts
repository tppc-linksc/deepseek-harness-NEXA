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
    }, paths)).toEqual({
      DSH_HOME: paths.runtime,
      DSH_AGENTS_HOME: paths.agents,
      DSH_DESKTOP_HOST: '1',
      DSH_TELEMETRY_DISABLED: '1',
      DEEPSEEK_API_KEY: 'preserved',
    })
  })
})
