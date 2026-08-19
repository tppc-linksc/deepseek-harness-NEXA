/** Main-process desktop update state machine with verified streamed downloads. */

import { createHash } from 'node:crypto'
import { chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  compareDesktopVersions,
  DESKTOP_UPDATE_INSTALLER_MAX_BYTES,
  DESKTOP_UPDATE_MANIFEST_MAX_BYTES,
  DESKTOP_UPDATE_RELEASES_MAX_BYTES,
  DESKTOP_UPDATE_RELEASES_URL,
  parseDesktopUpdateManifest,
  selectLatestDesktopUpdateRelease,
  selectDesktopUpdateAsset,
  type DesktopUpdateAsset,
  type DesktopUpdateManifest,
  type DesktopUpdateState,
} from './update-contract.ts'

interface UpdatePreferences {
  readonly schemaVersion: 1
  readonly automaticChecks: boolean
  readonly lastCheckedAt?: string
}

interface StagedUpdate {
  readonly schemaVersion: 1
  readonly version: string
  readonly fileName: string
  readonly sha256: string
  readonly size: number
}

interface DesktopUpdateStatePatch {
  readonly phase: DesktopUpdateState['phase']
  readonly availableVersion?: string | undefined
  readonly upstreamVersion?: string | undefined
  readonly releaseNotesUrl?: string | undefined
  readonly downloadedBytes?: number | undefined
  readonly totalBytes?: number | undefined
  readonly lastCheckedAt?: string | undefined
  readonly error?: string | undefined
}

/** External capabilities required by the update manager. */
export interface DesktopUpdateManagerOptions {
  readonly currentVersion: string
  readonly platform: NodeJS.Platform
  readonly arch: string
  readonly storageDirectory: string
  readonly fetch: (input: string, init: RequestInit) => Promise<Response>
  readonly openPath: (path: string) => Promise<string>
  readonly quit: () => void
  readonly now?: () => Date
  /** Direct manifest entry that bypasses GitHub release discovery. */
  readonly manifestUrl?: string
  /** GitHub Releases API entry used when no direct manifest is configured. */
  readonly releaseFeedUrl?: string
}

const preferencesFileName = 'preferences.json'
const stagedFileName = 'staged.json'

type UpdateServiceFailure = 'http' | 'invalid-release' | 'network' | 'rate-limit' | 'release-not-ready'

class UpdateServiceError extends Error {
  readonly failure: UpdateServiceFailure

  constructor(failure: UpdateServiceFailure, message: string) {
    super(message)
    this.failure = failure
  }
}

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function readLimited(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const announced = response.headers.get('content-length')
  if (announced !== null && (!/^\d+$/u.test(announced) || Number(announced) > maximumBytes)) {
    throw new Error('response exceeds the accepted size')
  }
  if (response.body === null) throw new Error('response body is missing')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    size += result.value.byteLength
    if (size > maximumBytes) {
      await reader.cancel('response exceeds the accepted size')
      throw new Error('response exceeds the accepted size')
    }
    chunks.push(result.value)
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function parsePreferences(value: unknown): UpdatePreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('preferences must be an object')
  const source = value as Record<string, unknown>
  const fields = Object.keys(source)
  if (fields.some(field => !['schemaVersion', 'automaticChecks', 'lastCheckedAt'].includes(field))) {
    throw new Error('preferences fields are invalid')
  }
  if (source.schemaVersion !== 1 || typeof source.automaticChecks !== 'boolean') {
    throw new Error('preferences fields are invalid')
  }
  if (source.lastCheckedAt !== undefined && (
    typeof source.lastCheckedAt !== 'string' || !Number.isFinite(Date.parse(source.lastCheckedAt))
  )) {
    throw new Error('preferences.lastCheckedAt must be an ISO timestamp')
  }
  return {
    schemaVersion: 1,
    automaticChecks: source.automaticChecks,
    ...(source.lastCheckedAt === undefined ? {} : { lastCheckedAt: source.lastCheckedAt }),
  }
}

function parseStaged(value: unknown): StagedUpdate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('staged update must be an object')
  const source = value as Record<string, unknown>
  const fields = Object.keys(source)
  if (
    fields.length !== 5
    || fields.some(field => !['schemaVersion', 'version', 'fileName', 'sha256', 'size'].includes(field))
    || source.schemaVersion !== 1
    || typeof source.version !== 'string'
    || typeof source.fileName !== 'string'
    || typeof source.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/u.test(source.sha256)
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(source.fileName)
    || !Number.isSafeInteger(source.size)
    || (source.size as number) <= 0
    || (source.size as number) > DESKTOP_UPDATE_INSTALLER_MAX_BYTES
  ) {
    throw new Error('staged update fields are invalid')
  }
  return source as unknown as StagedUpdate
}

async function hashFile(path: string): Promise<string> {
  const file = await open(path, 'r')
  const hash = createHash('sha256')
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    while (true) {
      const { bytesRead } = await file.read(buffer, 0, buffer.byteLength)
      if (bytesRead === 0) break
      hash.update(buffer.subarray(0, bytesRead))
    }
  } finally {
    await file.close()
  }
  return hash.digest('hex')
}

function publicError(error: unknown): string {
  if (error instanceof UpdateServiceError) {
    switch (error.failure) {
      case 'network': return '无法连接更新服务，请检查网络或代理设置后重试。'
      case 'rate-limit': return '更新服务请求过于频繁，请稍后重试。'
      case 'http': return '更新服务暂时不可用，请稍后重试。'
      case 'invalid-release': return '更新服务返回了无效的发布资料。'
      case 'release-not-ready': return '检测到新版本，但发布资料尚未准备完成，请稍后重试。'
    }
  }
  if (!(error instanceof Error)) return '更新失败，请稍后重试。'
  if (error.message.includes('checksum')) return '安装包校验失败，请重新下载。'
  if (error.message.includes('size')) return '安装包大小与发布清单不一致。'
  if (error instanceof TypeError) return '无法连接更新服务，请检查网络或代理设置后重试。'
  if (error.message.includes('HTTP')) return '更新服务暂时不可用，请稍后重试。'
  return '更新失败，请稍后重试。'
}

/** Stateful desktop release checker and installer downloader. */
export class DesktopUpdateManager {
  private preferences: UpdatePreferences = { schemaVersion: 1, automaticChecks: true }
  private stateValue: DesktopUpdateState
  private manifest: DesktopUpdateManifest | undefined
  private asset: DesktopUpdateAsset | undefined
  private operation: Promise<void> | undefined
  private readonly now: () => Date
  private readonly manifestUrl: string | undefined
  private readonly releaseFeedUrl: string

  constructor(private readonly options: DesktopUpdateManagerOptions) {
    compareDesktopVersions(options.currentVersion, options.currentVersion)
    this.now = options.now ?? (() => new Date())
    this.manifestUrl = options.manifestUrl
    this.releaseFeedUrl = options.releaseFeedUrl ?? DESKTOP_UPDATE_RELEASES_URL
    this.stateValue = {
      phase: this.supportedTarget() ? 'idle' : 'unsupported',
      currentVersion: options.currentVersion,
      automaticChecks: true,
    }
  }

  /** Load preferences and a previously verified installer from desktop-owned storage. */
  async initialize(): Promise<void> {
    await mkdir(this.options.storageDirectory, { recursive: true })
    try {
      this.preferences = parsePreferences(JSON.parse(await readFile(this.path(preferencesFileName), 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') await this.quarantine(preferencesFileName)
    }
    this.stateValue = {
      ...this.stateValue,
      automaticChecks: this.preferences.automaticChecks,
      ...(this.preferences.lastCheckedAt === undefined ? {} : { lastCheckedAt: this.preferences.lastCheckedAt }),
    }
    try {
      const staged = parseStaged(JSON.parse(await readFile(this.path(stagedFileName), 'utf8')))
      const installer = this.path(staged.fileName)
      const details = await stat(installer)
      if (!details.isFile() || details.size !== staged.size) {
        throw new Error('staged installer size does not match metadata')
      }
      if (await hashFile(installer) !== staged.sha256) {
        throw new Error('staged installer checksum does not match metadata')
      }
      if (compareDesktopVersions(this.options.currentVersion, staged.version) < 0) {
        this.stateValue = {
          ...this.stateValue,
          phase: 'downloaded',
          availableVersion: staged.version,
          downloadedBytes: staged.size,
          totalBytes: staged.size,
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') await this.quarantine(stagedFileName)
    }
  }

  /** @returns renderer-safe updater state without local filesystem paths. */
  state(): DesktopUpdateState {
    return { ...this.stateValue }
  }

  /** @returns whether the last automatic check is absent or at least one day old. */
  shouldAutomaticallyCheck(): boolean {
    if (!this.preferences.automaticChecks || !this.supportedTarget()) return false
    if (this.preferences.lastCheckedAt === undefined) return true
    return this.now().getTime() - Date.parse(this.preferences.lastCheckedAt) >= 24 * 60 * 60 * 1000
  }

  /**
   * Enable or disable daily background release checks.
   * @param enabled - new automatic-check preference.
   */
  async setAutomaticChecks(enabled: boolean): Promise<void> {
    this.preferences = { ...this.preferences, automaticChecks: enabled }
    this.stateValue = { ...this.stateValue, automaticChecks: enabled }
    await this.persistPreferences()
  }

  /** Check the NEXA release feed for a newer compatible version. */
  async check(): Promise<void> {
    await this.runExclusive(async () => {
      if (!this.supportedTarget()) {
        this.setState({ phase: 'unsupported' })
        return
      }
      this.setState({ phase: 'checking', error: undefined })
      this.manifest = undefined
      this.asset = undefined
      try {
        const checkedAt = this.now().toISOString()
        let manifest: DesktopUpdateManifest
        if (this.manifestUrl !== undefined) {
          manifest = await this.fetchManifest(this.manifestUrl)
        } else {
          const release = await this.fetchLatestRelease()
          if (compareDesktopVersions(this.options.currentVersion, release.version) >= 0) {
            await this.recordCheck(checkedAt)
            this.setUpToDate(checkedAt)
            return
          }
          if (release.manifestUrl === undefined) {
            await this.recordCheck(checkedAt)
            throw new UpdateServiceError('release-not-ready', `release ${release.tag} has no stable.json asset`)
          }
          manifest = await this.fetchManifest(release.manifestUrl)
          if (manifest.version !== release.version) {
            throw new UpdateServiceError(
              'invalid-release',
              `release ${release.tag} does not match manifest version ${manifest.version}`,
            )
          }
        }
        await this.recordCheck(checkedAt)
        if (compareDesktopVersions(this.options.currentVersion, manifest.version) >= 0) {
          this.setUpToDate(checkedAt)
          return
        }
        const asset = selectDesktopUpdateAsset(manifest, this.options.platform, this.options.arch)
        if (asset === undefined) {
          this.manifest = undefined
          this.asset = undefined
          this.setState({
            phase: 'unsupported',
            availableVersion: undefined,
            upstreamVersion: undefined,
            releaseNotesUrl: undefined,
            downloadedBytes: undefined,
            totalBytes: undefined,
            lastCheckedAt: checkedAt,
            error: undefined,
          })
          return
        }
        this.manifest = manifest
        this.asset = asset
        this.setState({
          phase: 'available',
          availableVersion: manifest.version,
          upstreamVersion: manifest.upstream.version,
          releaseNotesUrl: manifest.notesUrl,
          totalBytes: asset.size,
          downloadedBytes: 0,
          lastCheckedAt: checkedAt,
        })
      } catch (error) {
        this.setState({ phase: 'error', error: publicError(error) })
        throw error
      }
    })
  }

  private async fetchJson(url: string, maximumBytes: number, accept: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.options.fetch(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        headers: { accept },
      })
    } catch {
      throw new UpdateServiceError('network', `failed to fetch ${url}`)
    }
    if (!response.ok) {
      const failure = response.status === 403 || response.status === 429 ? 'rate-limit' : 'http'
      throw new UpdateServiceError(failure, `update service HTTP ${response.status}`)
    }
    try {
      const body = await readLimited(response, maximumBytes)
      return JSON.parse(new TextDecoder().decode(body)) as unknown
    } catch {
      throw new UpdateServiceError('invalid-release', `invalid update service JSON from ${url}`)
    }
  }

  private async fetchManifest(url: string): Promise<DesktopUpdateManifest> {
    try {
      return parseDesktopUpdateManifest(await this.fetchJson(
        url,
        DESKTOP_UPDATE_MANIFEST_MAX_BYTES,
        'application/json',
      ))
    } catch (error) {
      if (error instanceof UpdateServiceError) throw error
      throw new UpdateServiceError('invalid-release', `invalid update manifest from ${url}`)
    }
  }

  private async fetchLatestRelease() {
    try {
      return selectLatestDesktopUpdateRelease(await this.fetchJson(
        this.releaseFeedUrl,
        DESKTOP_UPDATE_RELEASES_MAX_BYTES,
        'application/vnd.github+json',
      ))
    } catch (error) {
      if (error instanceof UpdateServiceError) throw error
      throw new UpdateServiceError('invalid-release', `invalid release feed from ${this.releaseFeedUrl}`)
    }
  }

  private async recordCheck(checkedAt: string): Promise<void> {
    this.preferences = { ...this.preferences, lastCheckedAt: checkedAt }
    await this.persistPreferences()
  }

  private setUpToDate(checkedAt: string): void {
    this.setState({
      phase: 'up-to-date',
      availableVersion: undefined,
      upstreamVersion: undefined,
      releaseNotesUrl: undefined,
      downloadedBytes: undefined,
      totalBytes: undefined,
      lastCheckedAt: checkedAt,
      error: undefined,
    })
  }

  /** Start a verified installer download without blocking the renderer request. */
  startDownload(): void {
    this.startInstallerOperation(false)
  }

  /** Download, verify, and open the compatible installer as one user-approved operation. */
  startUpdate(): void {
    this.startInstallerOperation(true)
  }

  private startInstallerOperation(openWhenReady: boolean): void {
    if (this.operation !== undefined) throw new Error('another update operation is active')
    const manifest = this.manifest
    const asset = this.asset
    if (manifest === undefined || asset === undefined) throw new Error('no compatible update is available')
    this.setState({
      phase: 'downloading',
      availableVersion: manifest.version,
      upstreamVersion: manifest.upstream.version,
      releaseNotesUrl: manifest.notesUrl,
      downloadedBytes: 0,
      totalBytes: asset.size,
      error: undefined,
    })
    const running = (async () => {
      await this.download(manifest, asset)
      if (!openWhenReady || this.stateValue.phase !== 'downloaded') return
      try {
        await this.install()
      } catch (error) {
        this.setState({ phase: 'error', error: publicError(error) })
      }
    })()
    this.operation = running.finally(() => { this.operation = undefined })
  }

  /** Wait for the active operation; intended for lifecycle coordination and tests. */
  async waitForOperation(): Promise<void> {
    await this.operation
  }

  /** Open the verified installer after an explicit user action. */
  async install(): Promise<void> {
    const staged = parseStaged(JSON.parse(await readFile(this.path(stagedFileName), 'utf8')))
    const installer = this.path(staged.fileName)
    const details = await stat(installer)
    if (!details.isFile() || details.size !== staged.size) throw new Error('staged installer size does not match metadata')
    if (await hashFile(installer) !== staged.sha256) throw new Error('staged installer checksum does not match metadata')
    if (this.options.platform === 'linux') await chmod(installer, 0o755)
    this.setState({ phase: 'installing', error: undefined })
    const failure = await this.options.openPath(installer)
    if (failure !== '') {
      this.setState({ phase: 'error', error: '无法打开安装包，请在下载目录中手动打开。' })
      throw new Error(`failed to open installer: ${failure}`)
    }
    if (this.options.platform === 'win32') this.options.quit()
    else this.setState({ phase: 'downloaded' })
  }

  private async download(manifest: DesktopUpdateManifest, asset: DesktopUpdateAsset): Promise<void> {
    const finalPath = this.path(asset.fileName)
    const partialPath = `${finalPath}.part`
    try {
      await unlinkIfPresent(partialPath)
      const response = await this.options.fetch(asset.url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        headers: { accept: 'application/octet-stream' },
      })
      if (!response.ok) throw new Error(`installer HTTP ${response.status}`)
      const announced = response.headers.get('content-length')
      if (announced !== null && (!/^\d+$/u.test(announced) || Number(announced) !== asset.size)) {
        throw new Error('installer announced size does not match manifest')
      }
      if (response.body === null) throw new Error('installer response body is missing')
      const file = await open(partialPath, 'wx', 0o600)
      const hash = createHash('sha256')
      let downloaded = 0
      try {
        const reader = response.body.getReader()
        while (true) {
          const result = await reader.read()
          if (result.done) break
          downloaded += result.value.byteLength
          if (downloaded > asset.size || downloaded > DESKTOP_UPDATE_INSTALLER_MAX_BYTES) {
            await reader.cancel('installer exceeds manifest size')
            throw new Error('installer exceeds manifest size')
          }
          hash.update(result.value)
          await file.write(result.value)
          this.setState({ phase: 'downloading', downloadedBytes: downloaded, totalBytes: asset.size })
        }
        await file.sync()
      } finally {
        await file.close()
      }
      if (downloaded !== asset.size) throw new Error('installer size does not match manifest')
      if (hash.digest('hex') !== asset.sha256) throw new Error('installer checksum does not match manifest')
      await unlinkIfPresent(finalPath)
      await rename(partialPath, finalPath)
      const staged: StagedUpdate = {
        schemaVersion: 1,
        version: manifest.version,
        fileName: asset.fileName,
        sha256: asset.sha256,
        size: asset.size,
      }
      await writeFile(this.path(stagedFileName), `${JSON.stringify(staged, undefined, 2)}\n`, { mode: 0o600 })
      this.setState({ phase: 'downloaded', downloadedBytes: asset.size, totalBytes: asset.size })
    } catch (error) {
      let reportedError = error
      try {
        await unlinkIfPresent(partialPath)
      } catch (cleanupError) {
        reportedError = cleanupError
      }
      this.setState({ phase: 'error', error: publicError(reportedError) })
    }
  }

  private supportedTarget(): boolean {
    return (
      (this.options.platform === 'darwin' && this.options.arch === 'arm64')
      || (this.options.platform === 'win32' && this.options.arch === 'x64')
      || (this.options.platform === 'linux' && this.options.arch === 'x64')
    )
  }

  private setState(next: DesktopUpdateStatePatch): void {
    const merged = {
      ...this.stateValue,
      ...next,
    }
    this.stateValue = {
      phase: merged.phase,
      currentVersion: this.options.currentVersion,
      automaticChecks: this.preferences.automaticChecks,
      ...(merged.availableVersion === undefined ? {} : { availableVersion: merged.availableVersion }),
      ...(merged.upstreamVersion === undefined ? {} : { upstreamVersion: merged.upstreamVersion }),
      ...(merged.releaseNotesUrl === undefined ? {} : { releaseNotesUrl: merged.releaseNotesUrl }),
      ...(merged.downloadedBytes === undefined ? {} : { downloadedBytes: merged.downloadedBytes }),
      ...(merged.totalBytes === undefined ? {} : { totalBytes: merged.totalBytes }),
      ...(merged.lastCheckedAt === undefined ? {} : { lastCheckedAt: merged.lastCheckedAt }),
      ...(merged.error === undefined ? {} : { error: merged.error }),
    }
  }

  private async runExclusive(operation: () => Promise<void>): Promise<void> {
    if (this.operation !== undefined) return this.operation
    const running = operation()
    this.operation = running
    try {
      await running
    } finally {
      if (this.operation === running) this.operation = undefined
    }
  }

  private path(fileName: string): string {
    return join(this.options.storageDirectory, fileName)
  }

  private async persistPreferences(): Promise<void> {
    await writeFile(
      this.path(preferencesFileName),
      `${JSON.stringify(this.preferences, undefined, 2)}\n`,
      { mode: 0o600 },
    )
  }

  private async quarantine(fileName: string): Promise<void> {
    const source = this.path(fileName)
    const destination = this.path(`${fileName}.invalid-${this.now().getTime()}`)
    try {
      await rename(source, destination)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}
