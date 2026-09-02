import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const actionRoot = resolve(root, '.github/actions/configure-nexa-remote')
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('NEXA Remote CI authentication action', () => {
  it('exports an SSH command backed by owner-only files and removes them in the post action', () => {
    const runnerTemp = temporaryDirectory()
    const githubEnv = join(runnerTemp, 'github-env')
    const githubState = join(runnerTemp, 'github-state')
    writeFileSync(githubEnv, '')
    writeFileSync(githubState, '')

    const main = spawnSync(process.execPath, [resolve(actionRoot, 'main.mjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        INPUT_DEPLOY_KEY: 'test-private-key',
        RUNNER_TEMP: runnerTemp,
        GITHUB_ENV: githubEnv,
        GITHUB_STATE: githubState,
      },
    })
    expect(main.status, main.stderr).toBe(0)

    const state = readFileSync(githubState, 'utf8').trim()
    const authDirectory = state.slice('AUTH_DIRECTORY='.length)
    expect(state).toBe(`AUTH_DIRECTORY=${authDirectory}`)
    expect(authDirectory.startsWith(`${runnerTemp}/nexa-remote-auth-`)).toBe(true)
    expect(readFileSync(join(authDirectory, 'deploy-key'), 'utf8')).toBe('test-private-key\n')
    expect(readFileSync(join(authDirectory, 'known-hosts'), 'utf8')).toContain('github.com ssh-ed25519 ')
    expect(readFileSync(githubEnv, 'utf8')).toBe(`GIT_SSH_COMMAND=ssh -F '${authDirectory}/ssh-config'\n`)

    const cleanup = spawnSync(process.execPath, [resolve(actionRoot, 'cleanup.mjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNNER_TEMP: runnerTemp,
        STATE_AUTH_DIRECTORY: authDirectory,
      },
    })
    expect(cleanup.status, cleanup.stderr).toBe(0)
    expect(existsSync(authDirectory)).toBe(false)
  })

  it('fails before writing action state when the repository secret is missing', () => {
    const runnerTemp = temporaryDirectory()
    const githubEnv = join(runnerTemp, 'github-env')
    const githubState = join(runnerTemp, 'github-state')
    writeFileSync(githubEnv, '')
    writeFileSync(githubState, '')

    const result = spawnSync(process.execPath, [resolve(actionRoot, 'main.mjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        INPUT_DEPLOY_KEY: '',
        RUNNER_TEMP: runnerTemp,
        GITHUB_ENV: githubEnv,
        GITHUB_STATE: githubState,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Repository secret NEXA_REMOTE_DEPLOY_KEY is required')
    expect(readFileSync(githubEnv, 'utf8')).toBe('')
    expect(readFileSync(githubState, 'utf8')).toBe('')
  })
})

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nexa-private-dependency-test-'))
  temporaryDirectories.push(directory)
  return directory
}
