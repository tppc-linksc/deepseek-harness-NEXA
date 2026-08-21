# @deepseek-ai/dsh-desktop-app

[English](README.md) | 中文

DeepSeek Harness 的 desktop profile 层。它以 pull 驱动的 Electron UtilityProcess 桥替换 Web profile 的 HTTP/WebSocket 载体，同时保留同一套客户端插件图与产品身份。

Electron main 只在 UtilityProcess 环境中设置 `DSH_HOME` 与 `DSH_AGENTS_HOME`。因此会话、设置、凭据、profile 文件、插件安装、存储与 agent 配置位于桌面应用的 Electron `userData/runtime` 目录，不会改变 Web 或 CLI home。Electron main 持有 Chromium 状态与同级桌面日志目录。

renderer 从特权标准协议 `dsh://app` 加载。`/api`、`/plugins` 和扩展自有的 WebServer 请求经 UtilityProcess 消息端口传输；此 profile 不会创建 TCP 监听器。已注册的精确与最长前缀 WebServer 路由会先于逻辑 Connection 回退执行，因此同源扩展端点与 Web 载体保持相同的路由优先级。桥接会传输 `DELETE`、`GET`、`HEAD`、`OPTIONS`、`PATCH`、`POST` 与 `PUT`，在桌面上限内缓冲请求体，并通过现有 pull 通道流式传输普通响应与 SSE 响应。桌面 authority 通过验证后，Node 风格路由会收到合成的 HTTP 回环 host、Origin 与对端值，使其普通本机请求校验仍然有效；显式外域 Origin 会保持不变，供路由自身拒绝。

该组合包会把社区 `dshmarket` 包呈现为**扩展中心**，用于发现扩展、管理生命周期、查看诊断信息与实时选择主题。其中“已安装扩展”表示扩展中心在桌面 profile 中管理或识别到的社区包；独立的**运行组件**设置分区表示 Host 当前实际加载的组件，因此两份列表不必一致。市场的普通 WebServer 路由运行在内存兼容服务上，只能通过同一个私有自定义协议桥访问。桌面感知的市场操作会获得不可变的 `desktopProfiles.current` 身份，以及通过托管 subprocess 能力运行官方 `dsh plugin --profile desktop` CLI 的 `desktopPnpm` 服务。同一时间只允许一个包操作，并且在完整进程树退出前始终视为进行中。

该组合包还会把 `@deepseek-ai/dsh-client-ui-desktop-update` 作为独立的“应用更新”设置页和左下角提醒加载。它的浏览器端调用 `dsh://app` 上的 `/_desktop/update/*`；Electron main 会在转发给 Host 前处理这些私有路由，因此更新发现、下载存储、校验与打开安装包的权限不会交给浏览器插件或 UtilityProcess。下载与交接安装包保持为两个独立操作，macOS 会在成功打开 DMG 后退出正在运行的应用。

## 模型体验

### 桌面形态上下文

#### 模型看到的内容

该组合包会在共享 Harness 源码说明之后增加稳定的 `app:desktop-surface` prompt 小节。它把 renderer 说明为本地自定义协议客户端，并明确 Host 没有 HTTP 监听端口；它不会改变任务指令或工具策略。

#### Token 影响

每个会话增加一个 prompt 段落；在 Host 生命周期内保持不变。

#### KV Cache 影响

源码与桌面两个小节都会留在可复用的 prompt 前缀中，因此不会降低不同轮次之间的 KV cache 稳定性。

## 已知限制与暂缓事项

- **Profile patch 编辑后需要重启**：打包后的 Electron 无法暴露 Cordis 配置 HMR 所需的 Node 内部模块；启动时仍会应用 desktop profile 与 Harness home 的 patch 层。
- **上传请求会在跨进程前完整缓冲**：Electron main 会拒绝超过 160 MiB 的请求体；响应体仍按 pull 信号流式传输。
- **不提供原始 socket upgrade**：普通 HTTP 与 SSE 路由可以通过自定义协议工作，但 WebSocket 及其他 `registerUpgrade()` 路由需要网络监听载体，在桌面组合阶段会快速失败。
- **市场条目会执行第三方代码**：内置市场会把安装范围限制在其整理的目录，并默认阻止生命周期脚本，但用户在安装前仍需检查插件源码与所需能力。
- **更新需要用户操作系统交互**：非阻塞提醒只会在用户明确操作后开始后台下载，下载完成后的独立操作会再次校验并打开当前平台安装包。Windows 会退出应用并进入 NSIS；macOS 会在打开 DMG 后退出；Linux 会打开 AppImage。应用不会替换自身，也不会把跨平台流程描述为静默重启。
