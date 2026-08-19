# 桌面应用服务

[English](desktop.md) | 中文

desktop profile 为 [`dshmarket`](https://github.com/dsh-market/dsh-market) 等桌面感知的社区插件提供 `ctx.desktopProfiles` 与 `ctx.desktopPnpm`。这些服务只存在于 Electron UtilityProcess 内。它们公开隔离的桌面 profile，并运行官方 `dsh plugin --profile desktop` 操作，不会打开 HTTP 端口，也不会把包管理权限交给 renderer。同一 profile 还会通过私有 `dsh://app` 界面传输扩展 HTTP 路由与客户端 slot。

源码：[`packages/bundle/desktop-app/src/desktop-market-services.ts`](../../packages/bundle/desktop-app/src/desktop-market-services.ts)

## 运行时所有权

Electron main 提供 desktop profile、Harness home、命令运行目录、打包后的 DSH CLI、打包后的 pnpm 与应用可执行文件的绝对路径。启动时会拒绝缺失或相对路径。一个 Host generation 内的 profile 身份不可变，插件变更在应用重启后生效。

包操作通过托管 subprocess 服务执行。私有运行目录只包含 launcher 持有的 Node 与 pnpm shim，不会加入 Web 或 CLI 环境。同一时间只允许一个操作，并且完整子进程树退出前始终占用该操作位置。取消操作与 Host teardown 都会终止同一棵托管进程树。

## 扩展传输兼容性

已注册的精确与最长前缀 WebServer 路由会先于逻辑 Connection 回退运行，与 Web 应用的路由优先级一致。桌面桥会传输 `DELETE`、`GET`、`HEAD`、`OPTIONS`、`PATCH`、`POST` 与 `PUT`、请求流、常用 `IncomingMessage` 和 `ServerResponse` 标头方法、保持打开的 SSE 响应、取消信号与响应背压。它把已验证的桌面请求呈现为 HTTP 回环请求，供扩展自有的本机请求校验使用，同时保留显式外域 Origin 供路由拒绝。请求体在跨越进程通道前最多缓冲 160 MiB。自定义协议没有监听 socket，因此不提供 WebSocket 与其他原始 socket upgrade。

源码：[`packages/bundle/desktop-app/src/portless-webserver.ts`](../../packages/bundle/desktop-app/src/portless-webserver.ts)

## 扩展 UI 组合

`sidebar.footer.action` 列表在“设置”上方使用单列网格。每个注册项占据一行，直接子项会被限制在侧边栏宽度内，因此某个扩展的 flex 方向、换行或 flex-basis 规则无法再把同级入口移动到隐藏的横向列。收起后的窄栏为每项分配一个 36 像素行。各注册项仍持有自身按钮与 portalled panel 的呈现。

源码：[`packages/client/ui-sidebar/src/client/SidebarRoot.module.css`](../../packages/client/ui-sidebar/src/client/SidebarRoot.module.css)

## 启动诊断

已安装扩展无法激活时，Host loader 仍会快速失败。Electron 会在依赖 renderer 之前捕获该致命结果，显示包含 loader 错误的本地化原生对话框，并提供桌面 profile 与 Host 日志位置。恢复过程中，应用不会静默删除、禁用或改写扩展。

源码：[`apps/desktop/src/host-failure.ts`](../../apps/desktop/src/host-failure.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxdesktoppnpm--desktoppnpmservice"></a>

### `ctx.desktopPnpm` — `DesktopPnpmService`

Package-manager service that runs one official DSH plugin operation at a time.

```ts cordis-catalog
/**
 * Run packaged pnpm directly in the active desktop profile.
 * @param args - pnpm arguments following its JavaScript entry.
 * @param signal - optional operation cancellation.
 * @returns live output streams and completion.
 */
run(args: readonly string[], signal?: AbortSignal): DesktopPnpmHandle

/**
 * Run the official `dsh plugin` command against the desktop profile.
 * @param args - plugin subcommand arguments supplied by the market.
 * @param invokingDir - absolute directory anchoring relative package specifications.
 * @param signal - optional operation cancellation.
 * @returns live output streams and completion.
 */
runPlugin(args: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
```

Source: [`packages/bundle/desktop-app/src/desktop-market-services.ts:110`](../../packages/bundle/desktop-app/src/desktop-market-services.ts)

<a id="ctxdesktopprofiles--desktopprofiles"></a>

### `ctx.desktopProfiles` — `DesktopProfiles`

Structural service consumed by community desktop plugins.

Source: [`packages/bundle/desktop-app/src/desktop-market-services.ts:28`](../../packages/bundle/desktop-app/src/desktop-market-services.ts)
<!-- END GENERATED cordis-surface -->
