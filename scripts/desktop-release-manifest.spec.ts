import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildDesktopReleaseManifest,
  readDesktopUpstream,
  writeDesktopReleaseMetadata,
} from './desktop-release-manifest.ts'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function releaseDirectory(version = '0.1.0-rc.6'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'desktop-release-'))
  directories.push(directory)
  for (const suffix of ['mac-arm64.dmg', 'win-x64.exe', 'linux-x64.AppImage']) {
    await writeFile(join(directory, `DeepSeek-NEXA-${version}-${suffix}`), suffix)
  }
  return directory
}

describe('desktop release manifest', () => {
  it('hashes the complete platform set and writes stable metadata', async () => {
    const directory = await releaseDirectory()
    const manifest = await buildDesktopReleaseManifest({
      version: '0.1.0-rc.6',
      tag: 'nexa-v0.1.0-rc.6',
      publishedAt: '2026-08-18T00:00:00.000Z',
      assetsDirectory: directory,
      upstream: {
        version: '0.1.0-rc.7',
        tag: 'dsh-v0.1.0-rc.7',
        commit: '99f6f02fecdb7dff40c3fbc9470f5907c29f74ca',
      },
    })
    expect(manifest.assets).toHaveLength(3)
    expect(manifest.assets[0]?.sha256).toBe(createHash('sha256').update('mac-arm64.dmg').digest('hex'))

    await writeDesktopReleaseMetadata(manifest, directory)
    const stable = JSON.parse(await readFile(join(directory, 'stable.json'), 'utf8')) as { version: string }
    const checksums = await readFile(join(directory, 'SHA256SUMS.txt'), 'utf8')
    expect(stable.version).toBe('0.1.0-rc.6')
    expect(checksums).toContain('DeepSeek-NEXA-0.1.0-rc.6-win-x64.exe')
  })

  it('rejects an incomplete release and a mismatched tag', async () => {
    const directory = await releaseDirectory()
    await expect(buildDesktopReleaseManifest({
      version: '0.1.0-rc.6',
      tag: 'nexa-v0.1.0-rc.5',
      publishedAt: '2026-08-18T00:00:00.000Z',
      assetsDirectory: directory,
      upstream: {
        version: '0.1.0-rc.7',
        tag: 'dsh-v0.1.0-rc.7',
        commit: '99f6f02fecdb7dff40c3fbc9470f5907c29f74ca',
      },
    })).rejects.toThrow('release tag')

    await unlink(join(directory, 'DeepSeek-NEXA-0.1.0-rc.6-linux-x64.AppImage'))
    await expect(buildDesktopReleaseManifest({
      version: '0.1.0-rc.6',
      tag: 'nexa-v0.1.0-rc.6',
      publishedAt: '2026-08-18T00:00:00.000Z',
      assetsDirectory: directory,
      upstream: {
        version: '0.1.0-rc.7',
        tag: 'dsh-v0.1.0-rc.7',
        commit: '99f6f02fecdb7dff40c3fbc9470f5907c29f74ca',
      },
    })).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('validates recorded upstream metadata', async () => {
    const directory = await releaseDirectory()
    const path = join(directory, 'upstream.json')
    await writeFile(path, JSON.stringify({
      schemaVersion: 1,
      version: '0.1.0-rc.7',
      tag: 'dsh-v0.1.0-rc.7',
      commit: '99f6f02fecdb7dff40c3fbc9470f5907c29f74ca',
    }))
    await expect(readDesktopUpstream(path)).resolves.toMatchObject({ tag: 'dsh-v0.1.0-rc.7' })
  })
})
