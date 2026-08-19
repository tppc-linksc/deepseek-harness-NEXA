/** Native startup-failure presentation for a desktop Host that cannot load. */

/** User-reachable locations relevant to a failed desktop Host. */
export interface DesktopHostFailureLocations {
  /** Desktop profile containing installed extension packages. */
  readonly profileDirectory: string
  /** Host log containing the complete loader diagnostic. */
  readonly logFile: string
}

/** Follow-up selected from the native startup-failure dialog. */
export type DesktopHostFailureAction =
  | { readonly kind: 'open'; readonly path: string }
  | { readonly kind: 'quit' }

/** Electron-compatible message-box fields without importing Electron into tests. */
export interface DesktopHostFailureDialog {
  readonly type: 'error'
  readonly title: string
  readonly message: string
  readonly detail: string
  readonly buttons: string[]
  readonly defaultId: number
  readonly cancelId: number
  readonly noLink: true
}

/**
 * Build localized native recovery guidance for a Host startup failure.
 * @param error - failure reported by the UtilityProcess or desktop bootstrap.
 * @param locations - desktop profile and log locations.
 * @param locale - Electron application locale.
 * @returns message-box fields safe to show before any renderer exists.
 */
export function desktopHostFailureDialog(
  error: unknown,
  locations: DesktopHostFailureLocations,
  locale: string,
): DesktopHostFailureDialog {
  const chinese = locale.toLowerCase().startsWith('zh')
  const diagnostic = conciseError(error)
  return chinese
    ? {
      type: 'error',
      title: 'DeepSeek NEXA 启动失败',
      message: '桌面后台服务无法启动',
      detail: `新安装或更新的扩展可能与当前版本不兼容。应用没有删除或改写扩展数据。\n\n错误：${diagnostic}\n\n扩展目录：${locations.profileDirectory}\n日志：${locations.logFile}`,
      buttons: ['打开扩展目录', '打开日志目录', '退出'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    }
    : {
      type: 'error',
      title: 'DeepSeek NEXA startup failed',
      message: 'The desktop Host could not start',
      detail: `A newly installed or updated extension may be incompatible with this version. The application did not remove or rewrite extension data.\n\nError: ${diagnostic}\n\nExtensions: ${locations.profileDirectory}\nLog: ${locations.logFile}`,
      buttons: ['Open extensions', 'Open logs', 'Quit'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    }
}

/**
 * Resolve one message-box response to a filesystem action or quit.
 * @param response - Electron message-box button index.
 * @param locations - desktop profile and log locations.
 * @returns selected recovery follow-up.
 */
export function desktopHostFailureAction(
  response: number,
  locations: DesktopHostFailureLocations,
): DesktopHostFailureAction {
  if (response === 0) return { kind: 'open', path: locations.profileDirectory }
  if (response === 1) return { kind: 'open', path: locations.logFile }
  return { kind: 'quit' }
}

function conciseError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error)
  return value.replaceAll(/\u001B\[[0-?]*[ -/]*[@-~]/g, '').slice(0, 2000)
}
