# Agent Note: 无端口 Electron 桌面载体

Status: implemented

[English](2026-08-14-portless-electron-desktop-carrier.md) | 中文

## Problem

DeepSeek Harness 需要一个保留完整 Web GUI 的桌面应用，而不是创建一套功能长期分叉的第二界面。在 Electron 窗口后面运行普通 Web profile 仍会绑定 localhost 端口，并可能让并发运行的 Web 进程争用 profile、会话、设置、凭据、插件安装、日志和其他可写状态。renderer 也不能仅仅因为运行在桌面窗口中就获得 Node 或 preload 特权。

现有 RPC 设计已经把逻辑消息与物理载体分开（[GUI 分层与 RPC 协议](2026-07-19-gui-layering-and-rpc-protocol.md)），但 Host connection 分发器与客户端模块注册表此前会直接挂载 HTTP route。无端口桌面载体要求这些逻辑服务在没有 `dsh-host-webserver` 时仍可使用。

## Decision

`apps/desktop` 是 Electron 应用，与 DeepSeek Harness 其他形态使用相同产品名称、Web frontend dist、客户端插件图与 `desktop` profile。它不是独立品牌或产品 fork。Electron main 在 ready 之前把 `dsh` 注册为特权标准 scheme，并从 `dsh://app` 加载沙箱化 renderer；`nodeIntegration` 关闭，context isolation 与 Web security 开启，不暴露 preload API。main 提供外壳资源、manifest 与 favicon，并把当前客户端启动图注入 index.html。脚本策略允许同源字符串求值，因为客户端插件 runner 会通过 `new Function` 执行 Host 提供的 bundle；它不允许远程脚本源。macOS 打包会从 Web 产品的鲸鱼 favicon 生成应用图标。

Electron main 在一个隐藏 `UtilityProcess` 中以 `--profile desktop` 启动构建后的 `dsh` launcher。desktop bundle 叠加在 `base` 与 `web-app` 之上，随后禁用 Web startup/runtime、`dsh-host-webserver`、HTTP module 与 connection 适配器、WebSocket HMR 和浏览器 directory-picker 选择器，并启用 UtilityProcess 桥以及原生 directory-picker Host 与 Client 适配器。Electron 会刻意阻止打包应用访问 Cordis 配置 HMR 所需的 Node 内部模块，因此 desktop 子进程会把自己的 launcher 调用标记为仅在启动时应用 profile 与 Harness home 的 patch 层；编辑任一层后都需要重启应用。应用持有 UtilityProcess 启动、致命退出、取消、窗口生命周期与 teardown；Host 意外退出时，应用会拒绝活跃请求并终止桌面进程，不会留下已经断线的 renderer，renderer 也不持有 Host 进程句柄。

connection 根入口提供与传输无关的 `dispatch(request, authority)` 和动态 RPC channel 观察；其 `./web` 适配器持有 HTTP 信任分类、Fetch 桥、route 与 WebSocket 下行。客户端模块根入口持有全局 Loader fiber 观察、启动图、bundle 路径与 Fetch 方法；其 `./web` 适配器持有 `/plugins` HTTP route 与 index tap。客户端包 manifest 会先从 profile 解析，再从模块安装位置解析：部署仍可使用 profile 本地覆盖，而打包 profile 无需依赖 `createRequire` 无法穿过的 profile 链接，即可消费 `app.asar` 中的模块。这些多入口 Node 包会关闭代码分割，使显式发布文件分别携带完整的依赖闭包。浏览器载体因而保持不变，desktop 桥则可直接调用两项逻辑服务。

renderer 针对 `dsh:` scheme 选择 `FetchApiClient`。unary 调用、`respond` 与两条事件流都使用同源 Fetch；事件流保留既有 SSE 编解码。Electron main 把每个请求转换为经过校验的 structured-clone 消息并发送给 UtilityProcess，desktop 桥按 loopback authority 分发。响应头先行跨进程；只有 main 发送 `pull` 消息后，响应体才前进一个 chunk，从而保留流背压。abort 与流取消会发送 `cancel`，两个接收点都会在使用进程消息之前完成校验并重建对象。两个进程均不会创建 HTTP server 或 TCP 监听器。

Desktop 与 Web 保持同一产品身份，但使用不同的可写运行域。Electron main 把 `userData` 设为 `<appData>/DeepSeek Harness/desktop`；Chromium 状态留在其中，Host 分别以 `<userData>/runtime` 与 `<userData>/runtime/agents` 作为 `DSH_HOME` 和 `DSH_AGENTS_HOME`，Host 输出则写入 `<userData>/logs/host.log`。子进程环境会移除继承来的 `DSH_WEB_URL`，防止桌面会话把另一个运行中形态报告为自身。并发运行的 Web 或 CLI 进程继续使用原有 home 与资源。

安装包构建会部署桌面应用的生产依赖闭包，排除声明文件与 source map，移除文本 bundle 和元数据中的构建机器仓库路径，并在 Electron Builder 运行前校验目标平台的 `node-pty` 载荷。macOS 使用从 Web favicon 派生的图标和 ad-hoc 签名。手动触发的桌面安装包工作流会在 GitHub 原生 runner 上构建未签名的 Windows x64 NSIS 与 Linux x64 AppImage 产物；工作流只保留仓库只读权限，并且只上传安装包文件。

## Verification

协议测试会拒绝畸形 authority、method、id、header、body、响应状态值、chunk 与启动图。客户端测试固定 `dsh:` 对 `FetchApiClient` 与 loopback authority 的选择。客户端模块测试固定全局 sibling fiber 观察、profile 优先的包解析、安装位置后备和非空 anchor 列表要求。profile 与构建后 launcher 配置测试固定三 bundle 模板，并证明 Web server 与 Web 适配器处于禁用状态、desktop 桥处于启用状态。路径测试固定桌面命名空间、环境覆盖与仅启动时应用 patch 的标记。renderer shell 测试固定公共静态路径与客户端 evaluator 策略。打包应用的可见回归会进入设置界面和 workspace 作用域的新会话页，同时 renderer 控制台保持为空。真实 Electron 只有在 UtilityProcess 发布启动图后才会创建 renderer；按 PID 检查 Electron main、renderer 与 Harness UtilityProcess，均未发现 TCP 监听 socket。发布产物检查会校验 DMG 的 checksum 结构和应用签名，然后解包 `app.asar`，并拒绝凭据文件、会话或日志文件、source map、私钥材料、常见 Token 格式与本地构建路径。

## Alternatives considered

**在 Electron 中包装普通 Web server。** 这会保留 localhost 监听器，在桌面应用内继续承担 WebSocket 与 DNS rebinding 问题，并原样保留桌面载体本应消除的端口与可写 home 冲突。

**把 Web UI 重写成桌面原生界面。** 第二套 UI 会复制插件图、wire fold、无障碍行为、设置界面和以后增加的每个 GUI 功能。复用随附 frontend 后，Web UI 的改动会从同一实现进入两种形态。

**在 Electron main 中运行 Harness Host。** Host 生命周期、插件故障、agent 子进程活动和 renderer 载体将与应用控制进程混在一起。UtilityProcess 为 Host 提供明确的环境与 teardown 单元，同时仍保持一个桌面应用。

**暴露宽泛 contextBridge 或启用 Node 的 renderer。** 客户端插件属于 renderer 图。向这张图提供文件系统或进程 API 会扩大每个插件的权限，并在经过校验的 Harness 协议之外创建第二套桌面 RPC 表面。

**通过 `file://` 加载 frontend。** File origin 无法提供 module loading、Fetch 与同源路由所需的标准安全源行为。标准 `dsh://app` scheme 无需 server 即可提供一个本地应用源。

**在保留 Node Host 的同时使用 Tauri。** 既有 Host、插件 loader、原生依赖与子进程生命周期都由 Node 持有。Tauri 壳仍需分发并监管独立 Node runtime，还要跨 Rust 与 Node 重做消息载体；这会扩大平台与打包表面，却不会减少必须保留的 Host。

## Consequences

桌面应用无需维护第二套功能实现即可跟随 Web GUI，不暴露 TCP 端口，并可与 `dsh web` 并发运行而不共享可写应用状态。renderer 仍是 Web 安全主体，不是特权 Node 上下文；Harness Host 则保留现有 Node runtime 与插件模型。

代价包括 Electron 分发体积、一套额外进程消息协议、两种物理 Connection 适配器，以及最高 160 MiB 桌面限制下的完整请求缓冲。客户端插件图变更会重新加载桌面窗口而不使用 WebSocket HMR；profile 与 Harness home 的 patch 编辑则需要重启桌面应用。打包必须包含 Electron、Web dist、构建后的 CLI、desktop bundle 与完整 workspace 依赖闭包。
