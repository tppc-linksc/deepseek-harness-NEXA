import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveBundledPnpmBin } from '../src/bundled-tools.ts'

describe('bundled desktop tools', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'dsh-desktop-bundled-tools-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('resolves pnpm through its exported package entry', () => {
    const packageRoot = join(root, 'pnpm')
    const packageEntry = join(packageRoot, 'package.json')
    const pnpmBin = join(packageRoot, 'bin', 'pnpm.mjs')
    mkdirSync(join(packageRoot, 'bin'), { recursive: true })
    writeFileSync(packageEntry, '{}\n')
    writeFileSync(pnpmBin, '#!/usr/bin/env node\n')

    const requested: string[] = []
    expect(resolveBundledPnpmBin((specifier) => {
      requested.push(specifier)
      return packageEntry
    })).toBe(pnpmBin)
    expect(requested).toEqual(['pnpm'])
  })

  it('fails before launch when the deployed pnpm CLI is incomplete', () => {
    const packageEntry = join(root, 'incomplete-pnpm', 'package.json')
    mkdirSync(join(root, 'incomplete-pnpm'), { recursive: true })
    writeFileSync(packageEntry, '{}\n')

    expect(() => resolveBundledPnpmBin(() => packageEntry)).toThrow(
      `bundled pnpm CLI is missing: ${join(root, 'incomplete-pnpm', 'bin', 'pnpm.mjs')}`,
    )
  })
})
