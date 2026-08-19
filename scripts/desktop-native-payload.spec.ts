import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateDesktopNativePayload } from './desktop-native-payload.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('validateDesktopNativePayload', () => {
  it('accepts the complete Windows ConPTY prebuild', () => {
    const root = temporaryStaging()
    createFile(root, 'node_modules', 'node-pty', 'prebuilds', 'win32-x64', 'conpty.node')
    createFile(root, 'node_modules', 'node-pty', 'prebuilds', 'win32-x64', 'conpty_console_list.node')
    createFile(root, 'node_modules', 'node-pty', 'prebuilds', 'win32-x64', 'conpty', 'conpty.dll')
    createFile(root, 'node_modules', 'node-pty', 'prebuilds', 'win32-x64', 'conpty', 'OpenConsole.exe')

    expect(() => validateDesktopNativePayload(root, 'win', 'x64')).not.toThrow()
  })

  it('rejects the obsolete Windows pty.node layout', () => {
    const root = temporaryStaging()
    createFile(root, 'node_modules', 'node-pty', 'prebuilds', 'win32-x64', 'pty.node')

    expect(() => validateDesktopNativePayload(root, 'win', 'x64')).toThrow(
      'node-pty win32-x64 ConPTY addon is missing',
    )
  })

  it('rejects a Windows prebuild without its console-list addon', () => {
    const root = temporaryStaging()
    createFile(root, 'node_modules', 'node-pty', 'prebuilds', 'win32-arm64', 'conpty.node')

    expect(() => validateDesktopNativePayload(root, 'win', 'arm64')).toThrow(
      'node-pty win32-arm64 console-list addon is missing',
    )
  })

  it('makes the macOS spawn helper executable', () => {
    const root = temporaryStaging()
    createFile(root, 'node_modules', 'node-pty', 'prebuilds', 'darwin-arm64', 'pty.node')
    const helper = createFile(
      root,
      'node_modules',
      'node-pty',
      'prebuilds',
      'darwin-arm64',
      'spawn-helper',
    )

    validateDesktopNativePayload(root, 'mac', 'arm64')

    expect(statSync(helper).mode & 0o111).toBe(0o111)
  })

  it.each([
    ['build', 'Release', 'pty.node'],
    ['prebuilds', 'linux-x64', 'pty.node'],
  ])('accepts a Linux addon at node-pty/%s/%s/%s', (...segments) => {
    const root = temporaryStaging()
    createFile(root, 'node_modules', 'node-pty', ...segments)

    expect(() => validateDesktopNativePayload(root, 'linux', 'x64')).not.toThrow()
  })
})

function temporaryStaging(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-native-payload-'))
  roots.push(root)
  return root
}

function createFile(root: string, ...segments: string[]): string {
  const path = join(root, ...segments)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '')
  return path
}
