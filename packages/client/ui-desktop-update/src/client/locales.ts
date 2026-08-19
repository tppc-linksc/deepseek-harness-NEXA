/** Simplified Chinese copy for the desktop application update row. */
export const zh = {
  'nav': '应用更新',
  'title': '应用更新',
  'current': '当前版本',
  'automatic': '自动检查更新',
  'automatic.description': '每天后台检查；发现新版本后会提示，由你确认后下载并打开安装包',
  'status.idle': '尚未检查更新',
  'status.checking': '正在检查更新…',
  'status.current': '当前已是最新版本',
  'status.available': '发现新版本 {version}',
  'status.downloading': '正在下载 {progress}%',
  'status.downloaded': '安装包已下载并通过 SHA-256 校验',
  'status.installing': '正在打开安装包…',
  'status.unsupported': '当前系统架构暂无可用安装包',
  'status.error': '检查更新失败',
  'upstream': '包含官方 Harness {version}',
  'check': '检查更新',
  'download': '下载并继续安装',
  'install': '打开安装包',
  'notes': '发行说明',
} satisfies Record<string, string>

/** Application update locale key union. */
export type DesktopUpdateKey = keyof typeof zh

/** English copy checked against the Chinese key set. */
export const en = {
  'nav': 'Application update',
  'title': 'Application update',
  'current': 'Current version',
  'automatic': 'Automatically check for updates',
  'automatic.description': 'Checks daily and prompts before downloading, verifying, and opening an available installer',
  'status.idle': 'Updates have not been checked yet',
  'status.checking': 'Checking for updates…',
  'status.current': 'This is the latest version',
  'status.available': 'Version {version} is available',
  'status.downloading': 'Downloading {progress}%',
  'status.downloaded': 'The installer was downloaded and verified with SHA-256',
  'status.installing': 'Opening the installer…',
  'status.unsupported': 'No installer is available for this system architecture',
  'status.error': 'Update check failed',
  'upstream': 'Includes official Harness {version}',
  'check': 'Check for updates',
  'download': 'Download and continue installation',
  'install': 'Open installer',
  'notes': 'Release notes',
} satisfies Record<DesktopUpdateKey, string>
