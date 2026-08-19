# DeepSeek Harness desktop

[English](README.md) | 中文

桌面入口在 Electron 窗口中复用随附的 Web 客户端 bundle 与客户端插件图。renderer 使用 `dsh://app`；Electron main 以带响应背压的 pull 协议，把 API 与插件请求转发给隐藏 UtilityProcess。应用不会启动 Web server 或绑定 TCP 端口。

沙箱化 renderer 允许字符串求值，因为客户端插件 runner 会通过 `new Function` 执行 Host 提供的客户端 bundle。Node integration 仍保持关闭，不存在 preload API，导航限制在 `dsh://app`，脚本加载也保持同源。Electron main 会与带 hash 的 frontend 资源一同提供 Web manifest 与 favicon。macOS 打包会从同一鲸鱼 favicon 生成应用图标，不再保留 Electron 默认图标。

桌面状态有意隔离，但不创建单独的产品身份。Electron main 把 `<appData>/DeepSeek Harness/desktop` 用作 `userData`，仅向 UtilityProcess 传入其 `runtime` 与 `runtime/agents` 子目录作为 `DSH_HOME` 和 `DSH_AGENTS_HOME`，并把进程输出写入 `logs/host.log`。并发运行的 `dsh web` 会继续使用原有 Harness home、agent home、会话、设置、凭据、插件、存储、日志与监听端口。

应用更新偏好、未完成下载、已校验安装包与暂存元数据位于桌面端专用的 `updates` 子目录。它们不会与 Web 或 CLI 会话目录共用；删除更新下载也不会删除会话、工作区、插件、设置或凭据。

UtilityProcess 始终会收到 `DSH_TELEMETRY_DISABLED=1`；即使父进程环境选择开启，桌面发行版也无法上传会话遥测。模型请求仍会到达用户配置的提供方，并保留所属适配器文档规定的官方提供方标头。

Electron 不会在打包应用中暴露 Cordis 配置 HMR 所需的 Node 内部模块。因此，桌面 Host 会在启动时读取自身 profile 与 Harness home 的 `cordis.patch.yml` 层；编辑任一文件后需重启桌面应用。由运行时管理的设置与凭据仍保留各自的实时更新行为。

## 扩展中心

桌面组合把社区 [dsh-market](https://github.com/dsh-market/dsh-market) 插件呈现在**设置 → 扩展中心**。这里负责发现、安装、备份和管理社区扩展；“已安装扩展”标签页表示扩展中心在桌面 profile 中管理或识别到的包。“运行组件”则单独展示当前 Host 已加载的 Harness/Cordis 组件，因此两份列表不保证完全一致。**主题**标签页可以安装社区主题；支持实时激活的主题会立即切换当前外观。

安装、更新和卸载操作通过应用的托管进程树服务与内置 pnpm 运行官方 `dsh plugin --profile desktop` 命令。市场只会写入 `userData/runtime` 下由桌面端拥有的 profile，无法改变并发运行 Web UI 所用的 profile、会话、设置、凭据或插件。兼容 WebServer 的市场路由通过 `dsh://app` 在内存中分发，不会打开 TCP 监听器。

侧边栏会在“设置”上方为每个 `sidebar.footer.action` 扩展分配独立网格行。因此，注册项自身的 flex 方向、换行与 flex-basis 规则不会再把其他扩展推到侧边栏之外；收起后的窄栏也会为每项分配相同的 36 像素行。桌面请求桥为扩展自有 HTTP 路由提供与 Web 相同的精确／最长前缀优先级，传输标准安全 Fetch 方法，保留本机请求校验，并流式传输 SSE 响应。由于 `dsh://app` 没有监听 socket，原始 socket upgrade 仍不受支持。

市场条目与 GitHub topic 发现属于社区整理，不代表 DeepSeek 或 NEXA 背书。安装第三方代码前应检查界面展示的仓库与所需能力。除非用户在市场流程中明确允许，否则包生命周期脚本仍保持阻止状态。

如果扩展变更后 Host 无法启动，Electron 会在退出前显示本地化原生故障对话框。对话框会保留 profile、显示 loader 错误，并可打开桌面扩展目录或 `logs/host.log`；它不会静默删除或禁用任何包。

## 应用更新

默认情况下，桌面主进程每天最多查询一次 NEXA GitHub Releases API，其中同时包含稳定版与预发行版。检查会识别 `nexa-v<版本>` 和兼容旧发行的 `desktop-v<版本>` 标签，忽略 draft，并按语义版本选择最高版本。用户可以在独立的“应用更新”设置页中关闭自动检查或立即手动检查；只有 API 报告的版本高于当前应用时才要求发布清单，随后用户确认一次即可下载对应安装包、完成校验并进入操作系统安装流程。

发布清单按不可信输入处理。它必须指向本仓库的 GitHub Release 资源，与当前操作系统及架构匹配，并提供精确字节数与小写 SHA-256 摘要。应用把所选安装包流式写入私有 `.part` 文件，拒绝超出或缺少的字节，校验摘要后以原子重命名暂存，并在打开前再次校验暂存文件。本地文件系统路径不会传给沙箱化 renderer。

安装仍是用户明确触发的系统流程。macOS 会打开未签名的 DMG，用户替换应用后需要重新启动；Windows 会打开 NSIS 安装程序并退出正在运行的应用；Linux 会先赋予 AppImage 执行权限再打开。应用不会自行替换文件、执行下载的源码，也不会在没有用户确认时安装新版本。

当前发布目标为 macOS arm64 DMG、Windows x64 NSIS 与 Linux x64 AppImage。其他操作系统或架构会提示没有可用安装包。

## 构建与发行

构建仓库后运行 `pnpm --filter @deepseek-ai/dsh-desktop start`。各平台脚本会在 `dist/installers` 下生成 macOS DMG、Windows NSIS 安装程序或 Linux AppImage。

一次 NEXA 发行使用 `nexa-v<桌面版本>` 标签。创建标签前，需同时更新桌面应用、桌面组合包与桌面更新客户端包的版本，在 `.nexa/upstream.json` 中记录所含官方 Harness 标签与完整 commit，并准备双语发行说明。`NEXA desktop release` 工作流会在原生 runner 上构建三个安装包，等待 `desktop-release` environment 审批，然后把安装包、`SHA256SUMS.txt` 与 `stable.json` 发布为同一个 GitHub Release。`pnpm run release:desktop:manifest -- --assets <目录> --output <目录> --tag <标签>` 可在本地生成相同元数据。

定时运行的 `Official Harness update monitor` 会比较 `.nexa/upstream.json` 与 `deepseek-ai/deepseek-harness` 最新官方版本。如果两者不同，工作流只创建一个维护者 issue；它不会自动合并上游代码或发布 NEXA 版本。
