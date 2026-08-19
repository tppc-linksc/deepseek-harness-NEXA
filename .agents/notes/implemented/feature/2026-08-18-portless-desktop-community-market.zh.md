# Agent Note: 在无端口桌面 profile 中运行社区市场

Status: implemented

[English](2026-08-18-portless-desktop-community-market.md) | 中文

## 问题

DeepSeek Harness 社区已经通过 `dshmarket` 维护可搜索的插件目录、安装与更新流程、诊断能力和实时主题商店。在 NEXA 内重新实现这些功能会产生第二套目录与生命周期实现。直接加载面向 Web 的社区包也不完整：其路由依赖 WebServer 服务，打包后的 Electron 不是普通 Node 可执行文件，而且包操作绝不能指向并发运行的 Web UI profile，也不能新增本地 HTTP 端口。

## 决策

桌面组合在桌面载体之后加载固定稳定版本的 `dshmarket` 包。它的客户端 bundle 继续属于普通 Harness 客户端插件图，因此设置、扩展管理和主题切换直接使用社区实现，不维护私有源码 fork。NEXA 通过包管理器 patch 保留桌面端呈现改动：社区入口命名为**扩展中心**，Host Loader 与 settings 命名空间入口命名为**运行组件**。

“发现”页会让搜索控件保持普通文档流，并让分类筛选吸顶。初始间距属于搜索行而不是滚动容器，因此内容向上滚动时不会从吸顶筛选区上方的空白条中透出。

侧边栏持有 `sidebar.footer.action` 的可叠加几何：单列网格会在展开和窄栏布局中为每个扩展操作分配设置上方的独立行。直接子项受列宽约束，因此注册项自身的 flex 方向、换行或 flex-basis 规则无法把同级入口移动到另一条横向列。注册项自行持有控件和 portal 面板，不修改同级布局。

NEXA 提供市场使用的公开桌面服务。`desktopProfiles.current` 指向桌面端专用 `DSH_HOME` 下不可变的 `desktop` profile。`desktopPnpm.runPlugin()` 使用 `plugin --profile desktop` 调用打包的官方 DSH CLI；`desktopPnpm.run()` 调用打包的 pnpm 入口。两者都通过 `ELECTRON_RUN_AS_NODE` 运行 Electron、导入私有环境清理模块、使用私有 Node 与 pnpm shim、为原生依赖安装保留 Electron target，并通过既有托管 subprocess 服务执行。同一时间只有一个包操作拥有该服务，并会持续到完整进程树退出。取消操作与 Host teardown 都会终止该进程树。

桌面 profile 还会发布不拥有 socket 的结构化 WebServer 兼容服务。精确路由和最长前缀路由在内存中注册，并在未匹配请求回退到逻辑 Connection dispatcher 之前执行。扩展自有的 `/api` 端点因此与 Web 载体保持相同的路由优先级。Electron main 通过既有 `dsh://app` 消息桥收到请求后，适配器会把请求转换成普通路由使用的 Node 请求子集，再把响应捕获成 Fetch `Response`。桥接会传输安全 Fetch 方法集、常用请求与响应标头操作、保持打开的 SSE 流、取消信号与响应背压。Electron main 验证桌面 authority 后，适配器会把 host、Origin 与对端地址呈现为合成的 HTTP 回环请求，使普通扩展路由的安全校验无需监听 socket 也能工作。显式外域 Origin 会保持原值，供同源拒绝逻辑使用。原始 socket upgrade 路由不受支持，兼容端口值为零。

Electron main 持有 Host 致命故障的呈现。loader 或激活在 renderer 可用前失败时，应用会显示本地化原生对话框，其中包含诊断信息、桌面 profile 目录与 Host 日志路径。打开任一位置都不会改变 profile；用户关闭故障提示后应用才会退出，不再无提示消失。

Electron main 会向 UtilityProcess 传入物理应用可执行文件、打包的 DSH 与 pnpm 入口、Electron 版本、profile 目录和私有命令运行目录。除不可变的打包可执行文件外，所有路径都位于桌面应用命名空间内。市场操作永远不会选择 Web UI 的会话、凭据、设置、插件清单或日志。

即使 Electron 不提供 Node 内部 loader，打包 Host 仍会从 profile 解析裸插件名。根 Include 会先把 profile 包解析为绝对入口，再导入该入口；如果 profile 查询无法穿过指向应用归档的符号链接，解析会回退到打包安装。显式提供的宿主模块基准仍具有唯一权威。社区 bundle 行因此会从市场安装包所处的同一个 profile 加载，而内置行继续从 `app.asar` 加载。

## 验证

聚焦测试覆盖精确与最长前缀路由、扩展路由优先于逻辑 Connection 回退、安全 Fetch 方法、HTTP 回环兼容标头、显式外域 Origin 保留、请求体、响应状态与标头捕获、保持打开的 SSE 流及其取消、重复路由所有权、启动输入校验、不可变 profile 身份、官方 CLI 参数、桌面端独立环境值、私有命令 shim、进程树完全停止前的操作锁、启动故障操作、可叠加页脚几何，以及无法访问 Node 内部 loader 时的 profile／宿主裸包解析。桌面启动器与桌面组合包的 TypeScript 项目引用会一同编译。打包 Host 冒烟会强制关闭内部 loader，确认已安装的 `dsh-tokenledger` 与 `dsh-usage-stats` bundle 成功激活、进入桌面客户端图，并从各自扩展用量端点收到成功响应；市场客户端模块同样会进入该图，且不会启动监听器。

## 考虑过的替代方案

**实现 NEXA 专用市场和主题商店。** 拒绝，因为目录整理、安全策略、包生命周期行为、诊断、备份和主题激活会与社区包分叉，并形成独立长期维护负担。

**以子进程运行 `dsh web`，再通过 localhost 加载既有市场。** 拒绝，因为这会恢复监听端口、重复桌面载体，并可能选择 Web profile 及其状态。

**修改并打包 `dshmarket` 私有 fork。** 拒绝，因为该包已经定义桌面宿主服务。实现这些已公开接口可以直接替换社区更新，并把 Electron 专用代码限制在 NEXA 内。

**调用系统 Node 与 pnpm。** 拒绝，因为用户可能没有兼容的全局工具，而且打包 Electron 必须控制原生插件依赖使用的 Node ABI。

## 结果

桌面用户会在设置中获得社区扩展中心与主题商店；安装、更新、卸载、诊断和实时主题选择都使用官方 profile 机制。“已安装扩展”表示扩展中心在桌面 profile 中管理或识别到的包；“运行组件”表示 Host 当前实际加载的 Harness/Cordis 组件。两处用途不同，不要求条目完全一致。其他页脚入口可以叠加，不再依赖注册项 CSS。普通 HTTP 与 SSE 扩展路由会保留 Web 行为，而依赖原始 socket upgrade 的扩展按设计仍不兼容。扩展激活失败时会提供可见恢复位置，而不是无提示退出。桌面应用仍不会创建 HTTP 监听，并把全部可变市场状态与 Web、CLI profile 隔离。

市场会安装第三方可执行代码。进入目录不代表背书；除非用户明确允许，否则生命周期脚本仍保持阻止状态；用户在安装前必须检查仓库与所需能力。NEXA 需要有计划地更新固定的市场和 pnpm 版本，并继续兼容该包公开的桌面服务接口。
