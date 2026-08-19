import { describe, expect, it } from 'vitest'
import {
  desktopHostFailureAction,
  desktopHostFailureDialog,
  type DesktopHostFailureLocations,
} from '../src/host-failure.ts'

const locations: DesktopHostFailureLocations = {
  profileDirectory: '/desktop/runtime/profiles/desktop',
  logFile: '/desktop/logs/host.log',
}

describe('desktop Host startup failure presentation', () => {
  it('shows Chinese recovery locations without hiding the loader error', () => {
    const dialog = desktopHostFailureDialog(new Error('plugin apply failed'), locations, 'zh-CN')
    expect(dialog.title).toBe('DeepSeek NEXA 启动失败')
    expect(dialog.buttons).toEqual(['打开扩展目录', '打开日志目录', '退出'])
    expect(dialog.detail).toContain('plugin apply failed')
    expect(dialog.detail).toContain(locations.profileDirectory)
    expect(dialog.detail).toContain(locations.logFile)
  })

  it('shows the equivalent English recovery guidance', () => {
    const dialog = desktopHostFailureDialog('bundle missing', locations, 'en-US')
    expect(dialog.title).toBe('DeepSeek NEXA startup failed')
    expect(dialog.buttons).toEqual(['Open extensions', 'Open logs', 'Quit'])
    expect(dialog.detail).toContain('bundle missing')
  })

  it('maps buttons to the profile, log, and quit actions', () => {
    expect(desktopHostFailureAction(0, locations)).toEqual({ kind: 'open', path: locations.profileDirectory })
    expect(desktopHostFailureAction(1, locations)).toEqual({ kind: 'open', path: locations.logFile })
    expect(desktopHostFailureAction(2, locations)).toEqual({ kind: 'quit' })
    expect(desktopHostFailureAction(-1, locations)).toEqual({ kind: 'quit' })
  })
})
