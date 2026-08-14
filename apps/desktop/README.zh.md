# DeepSeek Harness desktop

[English](README.md) | 中文

桌面入口在 Electron 窗口中复用随附的 Web 客户端 bundle 与客户端插件图。renderer 使用 `dsh://app`；Electron main 以带响应背压的 pull 协议，把 API 与插件请求转发给隐藏 UtilityProcess。应用不会启动 Web server 或绑定 TCP 端口。

沙箱化 renderer 允许字符串求值，因为客户端插件 runner 会通过 `new Function` 执行 Host 提供的客户端 bundle。Node integration 仍保持关闭，不存在 preload API，导航限制在 `dsh://app`，脚本加载也保持同源。Electron main 会与带 hash 的 frontend 资源一同提供 Web manifest 与 favicon。macOS 打包会从同一鲸鱼 favicon 生成应用图标，不再保留 Electron 默认图标。

桌面状态有意隔离，但不创建单独的产品身份。Electron main 把 `<appData>/DeepSeek Harness/desktop` 用作 `userData`，仅向 UtilityProcess 传入其 `runtime` 与 `runtime/agents` 子目录作为 `DSH_HOME` 和 `DSH_AGENTS_HOME`，并把进程输出写入 `logs/host.log`。并发运行的 `dsh web` 会继续使用原有 Harness home、agent home、会话、设置、凭据、插件、存储、日志与监听端口。

UtilityProcess 始终会收到 `DSH_TELEMETRY_DISABLED=1`；即使父进程环境选择开启，桌面发行版也无法上传会话遥测。模型请求仍会到达用户配置的提供方，并保留所属适配器文档规定的官方提供方标头。

Electron 不会在打包应用中暴露 Cordis 配置 HMR 所需的 Node 内部模块。因此，桌面 Host 会在启动时读取自身 profile 与 Harness home 的 `cordis.patch.yml` 层；编辑任一文件后需重启桌面应用。由运行时管理的设置与凭据仍保留各自的实时更新行为。

构建仓库后运行 `pnpm --filter @deepseek-ai/dsh-desktop start`。各平台脚本会在 `dist/installers` 下生成 macOS DMG、Windows NSIS 安装程序或 Linux AppImage。由于运行时包含原生依赖，手动触发的 `Desktop installers (Windows and Linux)` GitHub Actions 工作流会在各自的原生 runner 上构建 Windows 与 Linux 格式。
