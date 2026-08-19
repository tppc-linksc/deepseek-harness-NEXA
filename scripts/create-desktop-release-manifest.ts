/** CLI for producing NEXA release checksums and updater metadata. */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildDesktopReleaseManifest,
  readDesktopUpstream,
  writeDesktopReleaseMetadata,
} from './desktop-release-manifest.ts'

const repositoryRoot = resolve(import.meta.dirname, '..')

function option(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} requires a value`)
  return value
}

const assetsDirectory = resolve(option('assets'))
const outputDirectory = resolve(option('output'))
const tag = option('tag')
const packageManifest = JSON.parse(
  await readFile(resolve(repositoryRoot, 'apps', 'desktop', 'package.json'), 'utf8'),
) as { version?: unknown }
if (typeof packageManifest.version !== 'string') throw new Error('desktop package version is missing')

const manifest = await buildDesktopReleaseManifest({
  version: packageManifest.version,
  tag,
  publishedAt: new Date().toISOString(),
  assetsDirectory,
  upstream: await readDesktopUpstream(resolve(repositoryRoot, '.nexa', 'upstream.json')),
})
await writeDesktopReleaseMetadata(manifest, outputDirectory)
