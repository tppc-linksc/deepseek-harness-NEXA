import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopUpdateManager } from '../src/update-manager.ts'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-desktop-update-'))
  directories.push(directory)
  return directory
}

function release(installer: Uint8Array, sha256 = createHash('sha256').update(installer).digest('hex')) {
  return {
    schemaVersion: 1,
    channel: 'stable',
    version: '0.1.0-rc.6',
    publishedAt: '2026-08-18T00:00:00.000Z',
    notesUrl: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/nexa-v0.1.0-rc.6',
    upstream: {
      version: '0.1.0-rc.7',
      tag: 'dsh-v0.1.0-rc.7',
      commit: '99f6f02fec1359086f9056445671db2be9620c73',
    },
    assets: [
      {
        platform: 'darwin',
        arch: 'arm64',
        installer: 'dmg',
        fileName: 'DeepSeek-NEXA-0.1.0-rc.6-mac-arm64.dmg',
        url: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-mac-arm64.dmg',
        sha256,
        size: installer.byteLength,
      },
      {
        platform: 'win32',
        arch: 'x64',
        installer: 'nsis',
        fileName: 'DeepSeek-NEXA-0.1.0-rc.6-win-x64.exe',
        url: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-win-x64.exe',
        sha256: 'b'.repeat(64),
        size: 1,
      },
      {
        platform: 'linux',
        arch: 'x64',
        installer: 'appimage',
        fileName: 'DeepSeek-NEXA-0.1.0-rc.6-linux-x64.AppImage',
        url: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-linux-x64.AppImage',
        sha256: 'c'.repeat(64),
        size: 1,
      },
    ],
  }
}

function feedRelease(
  version = '0.1.0-rc.6',
  { draft = false, prefix = 'nexa', withManifest = true }: {
    draft?: boolean
    prefix?: 'desktop' | 'nexa'
    withManifest?: boolean
  } = {},
) {
  const tag = `${prefix}-v${version}`
  return {
    tag_name: tag,
    draft,
    assets: withManifest
      ? [{
        name: 'stable.json',
        browser_download_url: `https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/${tag}/stable.json`,
      }]
      : [],
  }
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function macAsset(manifest: ReturnType<typeof release>) {
  const asset = manifest.assets.find(candidate => candidate.platform === 'darwin')
  if (asset === undefined) throw new Error('test release is missing its macOS asset')
  return asset
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('desktop update manager', () => {
  it('checks, downloads, verifies, then opens a compatible installer and quits on macOS', async () => {
    const installer = new TextEncoder().encode('verified installer')
    const manifest = release(installer)
    const fetch = vi.fn(async (input: string) => {
      if (input.startsWith('https://api.github.com/')) return response([feedRelease()])
      if (input.endsWith('stable.json')) return response(manifest)
      return new Response(installer, { status: 200, headers: { 'content-length': String(installer.byteLength) } })
    })
    const openPath = vi.fn(async () => '')
    const quit = vi.fn()
    const storageDirectory = await temporaryDirectory()
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory,
      fetch,
      openPath,
      quit,
      now: () => new Date('2026-08-18T12:00:00.000Z'),
    })
    await manager.initialize()
    expect(manager.shouldAutomaticallyCheck()).toBe(true)
    await manager.check()
    expect(manager.state()).toMatchObject({
      phase: 'available',
      availableVersion: '0.1.0-rc.6',
      upstreamVersion: '0.1.0-rc.7',
    })
    manager.startDownload()
    expect(manager.state()).toMatchObject({
      phase: 'downloading',
      downloadedBytes: 0,
      totalBytes: installer.byteLength,
    })
    await manager.waitForOperation()
    const installerPath = join(storageDirectory, macAsset(manifest).fileName)
    expect(await readFile(installerPath)).toEqual(Buffer.from(installer))
    expect(openPath).not.toHaveBeenCalled()
    expect(quit).not.toHaveBeenCalled()
    expect(manager.state().phase).toBe('downloaded')

    manager.startInstall()
    expect(manager.state().phase).toBe('installing')
    await manager.waitForOperation()
    expect(openPath).toHaveBeenCalledWith(installerPath)
    expect(quit).toHaveBeenCalledOnce()
    expect(openPath.mock.invocationCallOrder[0]).toBeLessThan(quit.mock.invocationCallOrder[0]!)
  })

  it('reports the current version when the latest release has no manifest', async () => {
    const fetch = vi.fn(async () => response([feedRelease('0.1.0-rc.6', { withManifest: false })]))
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.6',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory: await temporaryDirectory(),
      fetch,
      openPath: async () => '',
      quit: vi.fn(),
      now: () => new Date('2026-08-18T12:00:00.000Z'),
    })
    await manager.initialize()

    await manager.check()

    expect(manager.state()).toMatchObject({
      phase: 'up-to-date',
      lastCheckedAt: '2026-08-18T12:00:00.000Z',
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('reports a newer release whose manifest is not ready', async () => {
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory: await temporaryDirectory(),
      fetch: async () => response([feedRelease('0.1.0-rc.6', { withManifest: false })]),
      openPath: async () => '',
      quit: vi.fn(),
    })
    await manager.initialize()

    await expect(manager.check()).rejects.toThrow(/no stable\.json asset/u)
    expect(manager.state()).toMatchObject({
      phase: 'error',
      error: '检测到新版本，但发布资料尚未准备完成，请稍后重试。',
    })
  })

  it('distinguishes a network rejection from an HTTP error', async () => {
    const options = {
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin' as const,
      arch: 'arm64',
      openPath: async () => '',
      quit: vi.fn(),
    }
    const offline = new DesktopUpdateManager({
      ...options,
      storageDirectory: await temporaryDirectory(),
      fetch: async () => { throw new TypeError('offline') },
    })
    const unavailable = new DesktopUpdateManager({
      ...options,
      storageDirectory: await temporaryDirectory(),
      fetch: async () => new Response(null, { status: 404 }),
    })
    await Promise.all([offline.initialize(), unavailable.initialize()])

    await expect(offline.check()).rejects.toThrow()
    await expect(unavailable.check()).rejects.toThrow(/HTTP 404/u)

    expect(offline.state().error).toBe('无法连接更新服务，请检查网络或代理设置后重试。')
    expect(unavailable.state().error).toBe('更新服务暂时不可用，请稍后重试。')
  })

  it('reports GitHub rate limiting separately', async () => {
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory: await temporaryDirectory(),
      fetch: async () => new Response(null, { status: 429 }),
      openPath: async () => '',
      quit: vi.fn(),
    })
    await manager.initialize()

    await expect(manager.check()).rejects.toThrow(/HTTP 429/u)
    expect(manager.state().error).toBe('更新服务请求过于频繁，请稍后重试。')
  })

  it('reports malformed release JSON as invalid release data', async () => {
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory: await temporaryDirectory(),
      fetch: async () => new Response('{', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      openPath: async () => '',
      quit: vi.fn(),
    })
    await manager.initialize()

    await expect(manager.check()).rejects.toThrow()
    expect(manager.state().error).toBe('更新服务返回了无效的发布资料。')
  })

  it('rejects a manifest whose version does not match the selected release', async () => {
    const manifest = release(new Uint8Array([1]))
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory: await temporaryDirectory(),
      fetch: async input => input.startsWith('https://api.github.com/')
        ? response([feedRelease('0.1.0-rc.7')])
        : response(manifest),
      openPath: async () => '',
      quit: vi.fn(),
    })
    await manager.initialize()

    await expect(manager.check()).rejects.toThrow(/does not match manifest version/u)
    expect(manager.state()).toMatchObject({
      phase: 'error',
      error: '更新服务返回了无效的发布资料。',
    })
  })

  it('keeps an explicit manifest URL as a direct test and deployment entry', async () => {
    const manifest = release(new Uint8Array([1]))
    const manifestUrl = 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/stable.json'
    const fetch = vi.fn(async () => response(manifest))
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory: await temporaryDirectory(),
      fetch,
      openPath: async () => '',
      quit: vi.fn(),
      manifestUrl,
    })
    await manager.initialize()

    await manager.check()

    expect(manager.state().phase).toBe('available')
    expect(fetch).toHaveBeenCalledWith(manifestUrl, expect.any(Object))
  })

  it('deletes a partial installer when checksum verification fails', async () => {
    const installer = new TextEncoder().encode('tampered installer')
    const manifest = release(installer, '0'.repeat(64))
    const storageDirectory = await temporaryDirectory()
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory,
      fetch: async (input) => {
        if (input.startsWith('https://api.github.com/')) return response([feedRelease()])
        if (input.endsWith('stable.json')) return response(manifest)
        return new Response(installer, { status: 200 })
      },
      openPath: async () => '',
      quit: vi.fn(),
    })
    await manager.initialize()
    await manager.check()
    manager.startDownload()
    await manager.waitForOperation()
    expect(manager.state()).toMatchObject({ phase: 'error', error: '安装包校验失败，请重新下载。' })
    await expect(readFile(join(storageDirectory, `${macAsset(manifest).fileName}.part`))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not quit when the staged installer cannot be opened', async () => {
    const installer = new TextEncoder().encode('verified installer')
    const manifest = release(installer)
    const quit = vi.fn()
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory: await temporaryDirectory(),
      fetch: async (input) => {
        if (input.startsWith('https://api.github.com/')) return response([feedRelease()])
        if (input.endsWith('stable.json')) return response(manifest)
        return new Response(installer, { status: 200 })
      },
      openPath: async () => 'Launch Services rejected the path',
      quit,
    })
    await manager.initialize()
    await manager.check()
    manager.startDownload()
    await manager.waitForOperation()

    manager.startInstall()
    await manager.waitForOperation()

    expect(manager.state()).toMatchObject({
      phase: 'error',
      error: '无法打开安装包，请在下载目录中手动打开。',
    })
    expect(quit).not.toHaveBeenCalled()
  })

  it('persists the automatic-check preference and respects the daily interval', async () => {
    const storageDirectory = await temporaryDirectory()
    await writeFile(join(storageDirectory, 'preferences.json'), JSON.stringify({
      schemaVersion: 1,
      automaticChecks: true,
      lastCheckedAt: '2026-08-18T00:00:00.000Z',
    }))
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory,
      fetch: async () => response(release(new Uint8Array([1]))),
      openPath: async () => '',
      quit: vi.fn(),
      now: () => new Date('2026-08-18T12:00:00.000Z'),
    })
    await manager.initialize()
    expect(manager.shouldAutomaticallyCheck()).toBe(false)
    await manager.setAutomaticChecks(false)
    expect(manager.state().automaticChecks).toBe(false)
    expect(JSON.parse(await readFile(join(storageDirectory, 'preferences.json'), 'utf8'))).toMatchObject({
      schemaVersion: 1,
      automaticChecks: false,
    })
  })

  it('does not trust a staged installer whose checksum changed on disk', async () => {
    const installer = new TextEncoder().encode('verified installer')
    const manifest = release(installer)
    const storageDirectory = await temporaryDirectory()
    const asset = macAsset(manifest)
    await writeFile(join(storageDirectory, asset.fileName), 'tampered installer')
    await writeFile(join(storageDirectory, 'staged.json'), JSON.stringify({
      schemaVersion: 1,
      version: manifest.version,
      fileName: asset.fileName,
      sha256: asset.sha256,
      size: 'tampered installer'.length,
    }))
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'arm64',
      storageDirectory,
      fetch: async () => response(manifest),
      openPath: async () => '',
      quit: vi.fn(),
    })

    await manager.initialize()

    expect(manager.state().phase).toBe('idle')
    expect(await readdir(storageDirectory)).toContainEqual(expect.stringMatching(/^staged\.json\.invalid-/u))
  })

  it('reports unsupported runtimes without a network request', async () => {
    const fetch = vi.fn()
    const manager = new DesktopUpdateManager({
      currentVersion: '0.1.0-rc.5',
      platform: 'darwin',
      arch: 'x64',
      storageDirectory: await temporaryDirectory(),
      fetch,
      openPath: async () => '',
      quit: vi.fn(),
    })
    await manager.initialize()
    await manager.check()
    expect(manager.state().phase).toBe('unsupported')
    expect(fetch).not.toHaveBeenCalled()
  })
})
