/** Copy dictionaries for the plugin inventory Settings section. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '组件清单',
  loading: '正在读取运行组件…',
  error: '暂时无法读取运行组件。',
  retry: '重试',
  search: '搜索运行组件',
  catalog: '运行组件清单',
  empty: '暂无运行组件。',
  emptySearch: '没有匹配的运行组件。',
  enabledTag: '已启用',
  disabledTag: '已停用',
  configuration: '配置状态',
  cordis: 'Cordis 状态',
  unobserved: '未挂载',
  pending: '等待依赖',
  loadingPhase: '加载中',
  active: '已挂载',
  failed: '挂载失败',
  unloading: '卸载中',
} satisfies Record<string, string>

/** Plugin inventory locale key union. */
export type PluginInventoryLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Component list',
  loading: 'Reading runtime components…',
  error: 'Runtime components are temporarily unavailable.',
  retry: 'Retry',
  search: 'Search runtime components',
  catalog: 'Runtime component list',
  empty: 'No runtime components are available.',
  emptySearch: 'No matching runtime components.',
  enabledTag: 'Enabled',
  disabledTag: 'Disabled',
  configuration: 'Configuration',
  cordis: 'Cordis status',
  unobserved: 'Not mounted',
  pending: 'Waiting for dependencies',
  loadingPhase: 'Loading',
  active: 'Mounted',
  failed: 'Mount failed',
  unloading: 'Unloading',
} satisfies Record<PluginInventoryLocaleKey, string>
