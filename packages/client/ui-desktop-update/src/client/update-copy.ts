import type { DesktopUpdateKey } from './locales.ts'
import type { DesktopUpdateState } from './update-controller.ts'

/**
 * Select the explicit installer handoff label for the current platform.
 * @param installer - renderer-safe installer format.
 * @returns localized action key.
 */
export function installActionKey(installer: DesktopUpdateState['installer']): DesktopUpdateKey {
  switch (installer) {
    case 'dmg': return 'install.dmg'
    case 'nsis': return 'install.nsis'
    case 'appimage': return 'install.appimage'
    case undefined: return 'install.generic'
  }
}

/**
 * Select the downloaded notification detail for the current platform.
 * @param installer - renderer-safe installer format.
 * @returns localized detail key.
 */
export function downloadedDetailKey(installer: DesktopUpdateState['installer']): DesktopUpdateKey {
  switch (installer) {
    case 'dmg': return 'notice.downloaded.dmg'
    case 'nsis': return 'notice.downloaded.nsis'
    case 'appimage': return 'notice.downloaded.appimage'
    case undefined: return 'notice.downloaded.generic'
  }
}
