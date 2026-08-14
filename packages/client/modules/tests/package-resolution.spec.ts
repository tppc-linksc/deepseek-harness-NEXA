import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createPackageJsonResolver } from '../src/package-resolution.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function anchor(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-client-resolution-'))
  roots.push(root)
  return pathToFileURL(join(root, 'anchor.js')).href
}

function writeManifest(anchorUrl: string, packageName: string): string {
  const path = join(dirname(fileURLToPath(anchorUrl)), 'node_modules', ...packageName.split('/'), 'package.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({
    name: packageName,
    exports: { './package.json': './package.json' },
  }))
  return realpathSync(path)
}

describe('client package resolution', () => {
  it('rejects an empty anchor list at construction', () => {
    expect(() => createPackageJsonResolver([])).toThrow('requires at least one anchor')
  })

  it('falls back to the installation anchor when the profile anchor cannot resolve a package', () => {
    const profile = anchor()
    const installation = anchor()
    const expected = writeManifest(installation, '@fixture/client')

    expect(createPackageJsonResolver([profile, installation])('@fixture/client')).toBe(expected)
  })

  it('keeps a profile-local package ahead of the installation fallback', () => {
    const profile = anchor()
    const installation = anchor()
    const expected = writeManifest(profile, '@fixture/client')
    writeManifest(installation, '@fixture/client')

    expect(createPackageJsonResolver([profile, installation])('@fixture/client')).toBe(expected)
  })
})
