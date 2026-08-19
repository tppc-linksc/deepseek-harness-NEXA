import { describe, expect, it } from 'vitest'
import {
  compareDesktopVersions,
  parseDesktopUpdateManifest,
  selectLatestDesktopUpdateRelease,
  selectDesktopUpdateAsset,
} from '../src/update-contract.ts'

const manifest = {
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
      sha256: 'a'.repeat(64),
      size: 100,
    },
    {
      platform: 'win32',
      arch: 'x64',
      installer: 'nsis',
      fileName: 'DeepSeek-NEXA-0.1.0-rc.6-win-x64.exe',
      url: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-win-x64.exe',
      sha256: 'b'.repeat(64),
      size: 101,
    },
    {
      platform: 'linux',
      arch: 'x64',
      installer: 'appimage',
      fileName: 'DeepSeek-NEXA-0.1.0-rc.6-linux-x64.AppImage',
      url: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-linux-x64.AppImage',
      sha256: 'c'.repeat(64),
      size: 102,
    },
  ],
} as const

describe('desktop update contract', () => {
  it('orders release candidates using semantic-version precedence', () => {
    expect(compareDesktopVersions('0.1.0-rc.5', '0.1.0-rc.6')).toBeLessThan(0)
    expect(compareDesktopVersions('0.1.0-rc.10', '0.1.0-rc.6')).toBeGreaterThan(0)
    expect(compareDesktopVersions('0.1.0', '0.1.0-rc.99')).toBeGreaterThan(0)
    expect(compareDesktopVersions('1.2.3+build.1', '1.2.3+build.2')).toBe(0)
  })

  it('validates and selects the unique matching asset', () => {
    const parsed = parseDesktopUpdateManifest(manifest)
    expect(selectDesktopUpdateAsset(parsed, 'darwin', 'arm64')).toEqual(parsed.assets[0])
    expect(selectDesktopUpdateAsset(parsed, 'win32', 'x64')).toEqual(parsed.assets[1])
  })

  it('selects the newest stable or prerelease tag and ignores drafts', () => {
    const asset = (tag: string) => ({
      name: 'stable.json',
      browser_download_url: `https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/${tag}/stable.json`,
    })
    expect(selectLatestDesktopUpdateRelease([
      { tag_name: 'nexa-v0.2.0', draft: true, assets: [asset('nexa-v0.2.0')] },
      { tag_name: 'nexa-v0.1.0', draft: false, assets: [asset('nexa-v0.1.0')] },
      { tag_name: 'desktop-v0.1.1-rc.2', draft: false, assets: [asset('desktop-v0.1.1-rc.2')] },
      { tag_name: 'unrelated-v9.0.0', draft: false, assets: [] },
    ])).toEqual({
      version: '0.1.1-rc.2',
      tag: 'desktop-v0.1.1-rc.2',
      manifestUrl: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.1-rc.2/stable.json',
    })
  })

  it('accepts legacy desktop release tags in a manifest', () => {
    const legacy = {
      ...manifest,
      notesUrl: manifest.notesUrl.replace('nexa-v', 'desktop-v'),
      assets: manifest.assets.map(asset => ({ ...asset, url: asset.url.replace('nexa-v', 'desktop-v') })),
    }
    expect(parseDesktopUpdateManifest(legacy).version).toBe(manifest.version)
  })

  it.each([
    ['foreign URL', { ...manifest, notesUrl: 'https://example.com/release' }],
    ['unsafe file name', { ...manifest, assets: [{ ...manifest.assets[0], fileName: '../update.dmg' }] }],
    ['incomplete target set', { ...manifest, assets: manifest.assets.slice(0, 2) }],
    ['unsupported target', { ...manifest, assets: [{ ...manifest.assets[0], arch: 'x64' }, ...manifest.assets.slice(1) ] }],
    ['mismatched release tag', { ...manifest, notesUrl: 'https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/nexa-v0.1.0-rc.5' }],
    ['mismatched upstream tag', { ...manifest, upstream: { ...manifest.upstream, tag: 'dsh-v0.1.0-rc.6' } }],
  ])('rejects %s', (_label, value) => {
    expect(() => parseDesktopUpdateManifest(value)).toThrow()
  })

  it('rejects malformed semantic versions', () => {
    expect(() => compareDesktopVersions('0.1.0-01', '0.1.0')).toThrow(/leading zero/u)
  })
})
