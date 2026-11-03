'use strict'
/**
 * dsh-desktop preload — Plan A seam stub.
 *
 * Exposes a minimal `dshDesktop` bridge so the web UI can detect the desktop
 * carrier. Plan B (dist over a custom protocol + IPC carrier for /api RPC and
 * the two event streams) grows this into the full RPC/event bridge; the web
 * shell's connection layer already abstracts the carrier, so nothing in the
 * renderer needs to change when that lands.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshDesktop', {
  /** Platform of the host process ('darwin' on macOS). */
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  /**
   * Open Electron's native directory dialog. The web UI's directory-picker
   * seam prefers this over the host-side osascript chooser when present:
   * Electron's dialog needs no macOS automation (TCC) permission, so a
   * blocked chooser can never silently hang the workspace flow.
   * @returns the picked absolute path, or null when the user cancels.
   */
  pickDirectory: () => ipcRenderer.invoke('dsh-desktop:pick-directory'),
})