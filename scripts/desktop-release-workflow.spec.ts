import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '..')

describe('NEXA desktop release workflows', () => {
  it('publishes one verified installer for every supported platform', () => {
    const workflow = loadWorkflow('.github/workflows/desktop-installers.yml')
    const validate = workflowJob(workflow, 'validate')
    const build = workflowJob(workflow, 'build')
    const publish = workflowJob(workflow, 'publish')
    if (!isRecord(build.strategy) || !isRecord(build.strategy.matrix) || !Array.isArray(build.strategy.matrix.include)) {
      throw new TypeError('desktop build job must define a matrix include list')
    }
    const targets = build.strategy.matrix.include.filter(isRecord)
    expect(targets).toEqual([
      expect.objectContaining({ runner: 'macos-14', path: 'dist/installers/DeepSeek-NEXA-*-mac-arm64.dmg' }),
      expect.objectContaining({ runner: 'windows-2025', path: 'dist/installers/DeepSeek-NEXA-*-win-x64.exe' }),
      expect.objectContaining({ runner: 'ubuntu-24.04', path: 'dist/installers/DeepSeek-NEXA-*-linux-x64.AppImage' }),
    ])
    expect(build.needs).toBe('validate')
    expect(publish.needs).toEqual(['validate', 'build'])
    expect(publish.environment).toBe('desktop-release')

    const validateCommands = commandSteps(validate)
    const publishCommands = commandSteps(publish)
    expect(validateCommands.join('\n')).toContain('^nexa-v[0-9]+\\.[0-9]+\\.[0-9]+')
    expect(publishCommands.join('\n')).toContain('release:desktop:manifest')
    expect(publishCommands.join('\n')).toContain('gh release create')
    expect(publishCommands.join('\n')).toContain('--latest')
  })

  it('only reports official Harness changes to maintainers', () => {
    const workflow = loadWorkflow('.github/workflows/upstream-monitor.yml')
    const check = workflowJob(workflow, 'check')
    expect(workflow.permissions).toEqual({ contents: 'read', issues: 'write' })
    const commands = commandSteps(check).join('\n')
    expect(commands).toContain('deepseek-ai/deepseek-harness.git')
    expect(commands).toContain('.nexa/upstream.json')
    expect(commands).toContain('gh issue create')
    expect(commands).not.toContain('gh release create')
    expect(commands).not.toContain('git push')
  })
})

function loadWorkflow(path: string): Record<string, unknown> {
  const workflow: unknown = yaml.load(readFileSync(resolve(repositoryRoot, path), 'utf8'))
  if (!isRecord(workflow)) throw new TypeError(`${path} must define a workflow`)
  return workflow
}

function workflowJob(workflow: Record<string, unknown>, job: string): Record<string, unknown> {
  if (!isRecord(workflow.jobs) || !isRecord(workflow.jobs[job])) {
    throw new TypeError(`workflow must define the ${job} job`)
  }
  return workflow.jobs[job]
}

function commandSteps(job: Record<string, unknown>): string[] {
  if (!Array.isArray(job.steps)) throw new TypeError('workflow job must define steps')
  return job.steps.filter(isRecord).flatMap(step => typeof step.run === 'string' ? [step.run] : [])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
