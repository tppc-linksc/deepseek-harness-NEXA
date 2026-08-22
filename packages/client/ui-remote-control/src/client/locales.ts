/** Simplified Chinese copy for the mobile connection action. */
export const zh = {
  nav: '连接移动端',
  title: '连接移动端',
  subtitle: '微信扫码后直接打开远程界面',
  enabled: '允许移动端连接此设备',
  disabled: '开启后即可生成这台电脑专属的微信小程序码。',
  loading: '正在准备二维码…',
  connecting: '正在安全连接移动端…',
  error: '连接服务暂时不可用',
  codeUnavailable: '微信小程序码暂时无法生成',
  retry: '重试',
  qrAlt: '连接这台电脑的微信小程序码',
  scan: '使用微信扫码连接电脑',
  hint: '二维码短时有效，过期后会自动刷新。',
  security: '任务始终在这台电脑上执行',
} as const

/** Locale keys shared by both Remote Control dictionaries. */
export type RemoteControlLocaleKey = keyof typeof zh

/** English copy checked against the Chinese key set. */
export const en = {
  nav: 'Connect mobile',
  title: 'Connect mobile',
  subtitle: 'Scan with WeChat to open the remote view',
  enabled: 'Allow mobile access to this device',
  disabled: 'Turn this on to create a WeChat Mini Program code for this computer.',
  loading: 'Preparing code…',
  connecting: 'Securely connecting mobile…',
  error: 'The connection service is temporarily unavailable',
  codeUnavailable: 'A WeChat Mini Program code could not be generated',
  retry: 'Retry',
  qrAlt: 'WeChat Mini Program code for this computer',
  scan: 'Scan with WeChat to connect',
  hint: 'The short-lived code refreshes automatically when it expires.',
  security: 'Tasks always run on this computer',
} satisfies Record<RemoteControlLocaleKey, string>
