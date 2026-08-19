/** Generate verified public metadata for one three-platform NEXA desktop release. */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  parseDesktopUpdateManifest,
  type DesktopUpdateArch,
  type DesktopUpdateAsset,
  type DesktopUpdateInstaller,
  type DesktopUpdateManifest,
  type DesktopUpdatePlatform,
  type DesktopUpdateUpstream,
} from '../apps/desktop/src/update-contract.ts'

const releaseBaseUrl = 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download'
const releaseNotesBaseUrl = 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag'

interface DesktopReleaseTarget {
  readonly suffix: string
  readonly platform: DesktopUpdatePlatform
  readonly arch: DesktopUpdateArch
  readonly installer: DesktopUpdateInstaller
}

const releaseTargets: readonly DesktopReleaseTarget[] = [
  { suffix: 'mac-arm64.dmg', platform: 'darwin', arch: 'arm64', installer: 'dmg' },
  { suffix: 'win-x64.exe', platform: 'win32', arch: 'x64', installer: 'nsis' },
  { suffix: 'linux-x64.AppImage', platform: 'linux', arch: 'x64', installer: 'appimage' },
]

/** Inputs required to construct one immutable desktop release manifest. */
export interface DesktopReleaseManifestOptions {
  readonly version: string
  readonly tag: string
  readonly publishedAt: string
  readonly assetsDirectory: string
  readonly upstream: DesktopUpdateUpstream
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const value of createReadStream(path) as AsyncIterable<unknown>) {
    if (!(value instanceof Uint8Array)) throw new Error('release asset stream emitted a non-binary chunk')
    hash.update(value)
  }
  return hash.digest('hex')
}

async function releaseAsset(
  target: DesktopReleaseTarget,
  options: DesktopReleaseManifestOptions,
): Promise<DesktopUpdateAsset> {
  const fileName = `DeepSeek-NEXA-${options.version}-${target.suffix}`
  const path = join(resolve(options.assetsDirectory), fileName)
  const details = await stat(path)
  if (!details.isFile() || details.size <= 0) throw new Error(`release asset is empty: ${fileName}`)
  return {
    platform: target.platform,
    arch: target.arch,
    installer: target.installer,
    fileName,
    url: `${releaseBaseUrl}/${options.tag}/${fileName}`,
    sha256: await sha256(path),
    size: details.size,
  }
}

/**
 * Build and validate the update manifest for a complete NEXA release.
 * @param options - release identity, upstream revision, and installer directory.
 * @returns a manifest accepted by the desktop update client.
 */
export async function buildDesktopReleaseManifest(
  options: DesktopReleaseManifestOptions,
): Promise<DesktopUpdateManifest> {
  if (options.tag !== `nexa-v${options.version}`) throw new Error('release tag must match nexa-v<version>')
  const assets = await Promise.all(releaseTargets.map(target => releaseAsset(target, options)))
  return parseDesktopUpdateManifest({
    schemaVersion: 1,
    channel: 'stable',
    version: options.version,
    publishedAt: options.publishedAt,
    notesUrl: `${releaseNotesBaseUrl}/${options.tag}`,
    upstream: options.upstream,
    assets,
  })
}

/**
 * Write `stable.json` and `SHA256SUMS.txt` for one complete NEXA release.
 * @param manifest - validated desktop release manifest.
 * @param outputDirectory - directory receiving public release metadata.
 */
export async function writeDesktopReleaseMetadata(
  manifest: DesktopUpdateManifest,
  outputDirectory: string,
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true })
  const checksums = manifest.assets
    .map(asset => `${asset.sha256}  ${asset.fileName}`)
    .sort()
    .join('\n')
  await Promise.all([
    writeFile(join(outputDirectory, 'stable.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(join(outputDirectory, 'SHA256SUMS.txt'), `${checksums}\n`, 'utf8'),
  ])
}

/**
 * Load the recorded official Harness revision bundled by the fork.
 * @param path - path to `.nexa/upstream.json`.
 * @returns validated upstream release metadata.
 */
export async function readDesktopUpstream(path: string): Promise<DesktopUpdateUpstream> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('upstream metadata must be an object')
  }
  const source = value as Record<string, unknown>
  if (
    Object.keys(source).length !== 4
    || source.schemaVersion !== 1
    || typeof source.version !== 'string'
    || source.tag !== `dsh-v${source.version}`
    || typeof source.commit !== 'string'
    || !/^[0-9a-f]{40}$/u.test(source.commit)
  ) {
    throw new Error('upstream metadata fields are invalid')
  }
  return { version: source.version, tag: source.tag, commit: source.commit }
}
