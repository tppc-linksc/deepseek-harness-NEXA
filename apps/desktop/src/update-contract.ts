/** Validated release metadata shared by the desktop update manager and its tests. */

/** GitHub Releases feed used to discover both stable and prerelease desktop builds. */
export const DESKTOP_UPDATE_RELEASES_URL =
  'https://api.github.com/repos/tppc-linksc/deepseek-harness-NEXA/releases?per_page=20'

/** Maximum accepted release-manifest body size. */
export const DESKTOP_UPDATE_MANIFEST_MAX_BYTES = 256 * 1024

/** Maximum accepted size of the GitHub Releases discovery response. */
export const DESKTOP_UPDATE_RELEASES_MAX_BYTES = 2 * 1024 * 1024

/** A recognized desktop release and its optional update manifest asset. */
export interface DesktopUpdateRelease {
  readonly version: string
  readonly tag: string
  readonly manifestUrl?: string
}

/** Maximum accepted desktop installer size. */
export const DESKTOP_UPDATE_INSTALLER_MAX_BYTES = 2 * 1024 * 1024 * 1024

/** Operating systems with published NEXA installers. */
export type DesktopUpdatePlatform = 'darwin' | 'linux' | 'win32'

/** Architectures with published NEXA installers. */
export type DesktopUpdateArch = 'arm64' | 'x64'

/** Installation format used by one release asset. */
export type DesktopUpdateInstaller = 'appimage' | 'dmg' | 'nsis'

/** One platform installer described by a release manifest. */
export interface DesktopUpdateAsset {
  readonly platform: DesktopUpdatePlatform
  readonly arch: DesktopUpdateArch
  readonly installer: DesktopUpdateInstaller
  readonly fileName: string
  readonly url: string
  readonly sha256: string
  readonly size: number
}

/** Official Harness revision included in one NEXA desktop release. */
export interface DesktopUpdateUpstream {
  readonly version: string
  readonly tag: string
  readonly commit: string
}

/** Complete validated release manifest. */
export interface DesktopUpdateManifest {
  readonly schemaVersion: 1
  readonly channel: 'stable'
  readonly version: string
  readonly publishedAt: string
  readonly notesUrl: string
  readonly upstream: DesktopUpdateUpstream
  readonly assets: readonly DesktopUpdateAsset[]
}

/** Renderer-visible updater phases. */
type DesktopUpdatePhase =
  | 'available'
  | 'checking'
  | 'downloaded'
  | 'downloading'
  | 'error'
  | 'idle'
  | 'installing'
  | 'unsupported'
  | 'up-to-date'

/** Safe updater state returned to the sandboxed renderer. */
export interface DesktopUpdateState {
  readonly phase: DesktopUpdatePhase
  readonly currentVersion: string
  readonly automaticChecks: boolean
  readonly availableVersion?: string
  readonly upstreamVersion?: string
  readonly releaseNotesUrl?: string
  readonly downloadedBytes?: number
  readonly totalBytes?: number
  readonly lastCheckedAt?: string
  readonly error?: string
}

interface SemanticVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly prerelease: readonly string[]
}

const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const desktopReleaseTagPattern = /^(?:nexa|desktop)-v(.+)$/u
const sha256Pattern = /^[0-9a-f]{64}$/u
const commitPattern = /^[0-9a-f]{40}$/u
const safeFileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const releasePathPrefix = '/tppc-linksc/deepseek-harness-NEXA/releases/download/'
const supportedTargets: ReadonlyMap<string, { readonly installer: DesktopUpdateInstaller; readonly suffix: string }> = new Map([
  ['darwin/arm64', { installer: 'dmg', suffix: 'mac-arm64.dmg' }],
  ['win32/x64', { installer: 'nsis', suffix: 'win-x64.exe' }],
  ['linux/x64', { installer: 'appimage', suffix: 'linux-x64.AppImage' }],
] as const)

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`)
  return value
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = new Set(keys)
  const unexpected = Object.keys(value).filter(key => !expected.has(key))
  const missing = keys.filter(key => !(key in value))
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(`${label} fields are invalid`)
  }
}

function parseSemanticVersion(value: unknown, label: string): SemanticVersion {
  const source = string(value, label)
  const match = semanticVersionPattern.exec(source)
  if (match === null) throw new Error(`${label} must be a semantic version`)
  const prerelease = match[4]?.split('.') ?? []
  for (const identifier of prerelease) {
    if (/^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith('0')) {
      throw new Error(`${label} has a numeric prerelease identifier with a leading zero`)
    }
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  }
}

function desktopReleaseVersion(value: unknown, label: string): string | undefined {
  const source = string(value, label)
  const match = desktopReleaseTagPattern.exec(source)
  if (match === null) return undefined
  const version = match[1] as string
  parseSemanticVersion(version, label)
  return version
}

function comparePrerelease(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) return left.length === right.length ? 0 : left.length === 0 ? 1 : -1
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftPart = left[index]
    const rightPart = right[index]
    if (leftPart === undefined || rightPart === undefined) return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1
    if (leftPart === rightPart) continue
    const leftNumeric = /^\d+$/u.test(leftPart)
    const rightNumeric = /^\d+$/u.test(rightPart)
    if (leftNumeric && rightNumeric) return Number(leftPart) < Number(rightPart) ? -1 : 1
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    return leftPart < rightPart ? -1 : 1
  }
  return 0
}

/**
 * Compare two semantic versions without build-metadata precedence.
 * @param left - first semantic version.
 * @param right - second semantic version.
 * @returns a negative number, zero, or a positive number when left is older, equal, or newer.
 */
export function compareDesktopVersions(left: string, right: string): number {
  const leftVersion = parseSemanticVersion(left, 'left version')
  const rightVersion = parseSemanticVersion(right, 'right version')
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (leftVersion[key] !== rightVersion[key]) return leftVersion[key] < rightVersion[key] ? -1 : 1
  }
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease)
}

function projectReleaseUrl(value: unknown, label: string): string {
  const source = string(value, label)
  let url: URL
  try {
    url = new URL(source)
  } catch {
    throw new Error(`${label} must be an absolute URL`)
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'github.com'
    || !url.pathname.startsWith('/tppc-linksc/deepseek-harness-NEXA/releases/')
  ) {
    throw new Error(`${label} must point to this project's GitHub Releases`)
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new Error(`${label} must not contain credentials, query parameters, or fragments`)
  }
  return url.href
}

function releaseAssetUrl(value: unknown, label: string): string {
  const url = projectReleaseUrl(value, label)
  if (!new URL(url).pathname.startsWith(releasePathPrefix)) {
    throw new Error(`${label} must point to a downloadable project release asset`)
  }
  return url
}

/**
 * Select the highest non-draft NEXA release from untrusted GitHub API JSON.
 * @param value - parsed GitHub Releases response.
 * @returns the latest recognized release and its optional stable manifest asset.
 */
export function selectLatestDesktopUpdateRelease(value: unknown): DesktopUpdateRelease {
  if (!Array.isArray(value)) throw new Error('release feed must be an array')
  const releases: DesktopUpdateRelease[] = []
  for (const [index, candidate] of value.entries()) {
    const release = record(candidate, `releases[${index}]`)
    if (typeof release.draft !== 'boolean') throw new Error(`releases[${index}].draft must be a boolean`)
    if (release.draft) continue
    const tag = string(release.tag_name, `releases[${index}].tag_name`)
    const version = desktopReleaseVersion(tag, `releases[${index}].tag_name`)
    if (version === undefined) continue
    if (!Array.isArray(release.assets)) throw new Error(`releases[${index}].assets must be an array`)
    let manifestUrl: string | undefined
    for (const [assetIndex, candidateAsset] of release.assets.entries()) {
      const asset = record(candidateAsset, `releases[${index}].assets[${assetIndex}]`)
      if (asset.name !== 'stable.json') continue
      if (manifestUrl !== undefined) throw new Error(`releases[${index}] contains duplicate stable.json assets`)
      const url = releaseAssetUrl(
        asset.browser_download_url,
        `releases[${index}].assets[${assetIndex}].browser_download_url`,
      )
      if (new URL(url).pathname !== `${releasePathPrefix}${tag}/stable.json`) {
        throw new Error(`releases[${index}] stable.json URL does not match its tag`)
      }
      manifestUrl = url
    }
    releases.push({ version, tag, ...(manifestUrl === undefined ? {} : { manifestUrl }) })
  }
  if (releases.length === 0) throw new Error('release feed contains no recognized desktop release')
  return releases.reduce((latest, candidate) => {
    const precedence = compareDesktopVersions(candidate.version, latest.version)
    if (precedence > 0) return candidate
    if (precedence === 0 && latest.manifestUrl === undefined && candidate.manifestUrl !== undefined) return candidate
    return latest
  })
}

function parseAsset(value: unknown, index: number, version: string, releaseTag: string): DesktopUpdateAsset {
  const asset = record(value, `assets[${index}]`)
  exactKeys(asset, ['platform', 'arch', 'installer', 'fileName', 'url', 'sha256', 'size'], `assets[${index}]`)
  const platform = string(asset.platform, `assets[${index}].platform`)
  if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
    throw new Error(`assets[${index}].platform is unsupported`)
  }
  const arch = string(asset.arch, `assets[${index}].arch`)
  if (arch !== 'arm64' && arch !== 'x64') throw new Error(`assets[${index}].arch is unsupported`)
  const installer = string(asset.installer, `assets[${index}].installer`)
  const target = supportedTargets.get(`${platform}/${arch}`)
  if (target === undefined) throw new Error(`assets[${index}] target is unsupported`)
  if (installer !== target.installer) throw new Error(`assets[${index}].installer does not match its target`)
  const fileName = string(asset.fileName, `assets[${index}].fileName`)
  if (!safeFileNamePattern.test(fileName)) throw new Error(`assets[${index}].fileName is unsafe`)
  if (fileName !== `DeepSeek-NEXA-${version}-${target.suffix}`) {
    throw new Error(`assets[${index}].fileName does not match its target and version`)
  }
  const url = releaseAssetUrl(asset.url, `assets[${index}].url`)
  if (new URL(url).pathname !== `${releasePathPrefix}${releaseTag}/${fileName}`) {
    throw new Error(`assets[${index}].url does not match its release and fileName`)
  }
  const sha256 = string(asset.sha256, `assets[${index}].sha256`)
  if (!sha256Pattern.test(sha256)) throw new Error(`assets[${index}].sha256 must be lowercase hexadecimal`)
  const size = asset.size
  if (!Number.isSafeInteger(size) || (size as number) <= 0 || (size as number) > DESKTOP_UPDATE_INSTALLER_MAX_BYTES) {
    throw new Error(`assets[${index}].size is invalid`)
  }
  return { platform, arch, installer, fileName, url, sha256, size: size as number }
}

/**
 * Validate untrusted release-manifest JSON.
 * @param value - parsed JSON value.
 * @returns an immutable release manifest safe for update selection.
 */
export function parseDesktopUpdateManifest(value: unknown): DesktopUpdateManifest {
  const manifest = record(value, 'manifest')
  exactKeys(
    manifest,
    ['schemaVersion', 'channel', 'version', 'publishedAt', 'notesUrl', 'upstream', 'assets'],
    'manifest',
  )
  if (manifest.schemaVersion !== 1) throw new Error('manifest.schemaVersion must be 1')
  if (manifest.channel !== 'stable') throw new Error('manifest.channel must be stable')
  const version = string(manifest.version, 'manifest.version')
  parseSemanticVersion(version, 'manifest.version')
  const publishedAt = string(manifest.publishedAt, 'manifest.publishedAt')
  if (!Number.isFinite(Date.parse(publishedAt))) throw new Error('manifest.publishedAt must be an ISO timestamp')
  const notesUrl = projectReleaseUrl(manifest.notesUrl, 'manifest.notesUrl')
  const notesPathPrefix = '/tppc-linksc/deepseek-harness-NEXA/releases/tag/'
  const notesPath = new URL(notesUrl).pathname
  if (!notesPath.startsWith(notesPathPrefix)) {
    throw new Error('manifest.notesUrl does not match its version')
  }
  const releaseTag = notesPath.slice(notesPathPrefix.length)
  if (desktopReleaseVersion(releaseTag, 'manifest.notesUrl tag') !== version) {
    throw new Error('manifest.notesUrl does not match its version')
  }
  const upstreamValue = record(manifest.upstream, 'manifest.upstream')
  exactKeys(upstreamValue, ['version', 'tag', 'commit'], 'manifest.upstream')
  const upstreamVersion = string(upstreamValue.version, 'manifest.upstream.version')
  parseSemanticVersion(upstreamVersion, 'manifest.upstream.version')
  const tag = string(upstreamValue.tag, 'manifest.upstream.tag')
  if (tag !== `dsh-v${upstreamVersion}`) throw new Error('manifest.upstream.tag does not match its version')
  const commit = string(upstreamValue.commit, 'manifest.upstream.commit')
  if (!commitPattern.test(commit)) throw new Error('manifest.upstream.commit must be a full lowercase Git commit')
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== supportedTargets.size) {
    throw new Error('manifest.assets must contain the complete supported target set')
  }
  const assets = manifest.assets.map((asset, index) => parseAsset(asset, index, version, releaseTag))
  const targets = new Set<string>()
  for (const asset of assets) {
    const target = `${asset.platform}/${asset.arch}`
    if (targets.has(target)) throw new Error(`manifest.assets contains duplicate target ${target}`)
    targets.add(target)
  }
  for (const target of supportedTargets.keys()) {
    if (!targets.has(target)) throw new Error(`manifest.assets is missing target ${target}`)
  }
  return {
    schemaVersion: 1,
    channel: 'stable',
    version,
    publishedAt,
    notesUrl,
    upstream: { version: upstreamVersion, tag, commit },
    assets,
  }
}

/**
 * Select the unique installer for one desktop runtime.
 * @param manifest - validated release manifest.
 * @param platform - Electron process platform.
 * @param arch - Electron process architecture.
 * @returns the matching installer, or undefined when releases do not cover the runtime.
 */
export function selectDesktopUpdateAsset(
  manifest: DesktopUpdateManifest,
  platform: NodeJS.Platform,
  arch: string,
): DesktopUpdateAsset | undefined {
  return manifest.assets.find(asset => asset.platform === platform && asset.arch === arch)
}
