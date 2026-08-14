# @deepseek-ai/dsh-desktop-app

[English](README.md) | 中文

DeepSeek Harness 的 desktop profile 层。它以 pull 驱动的 Electron UtilityProcess 桥替换 Web profile 的 HTTP/WebSocket 载体，同时保留同一套客户端插件图与产品身份。

Electron main 只在 UtilityProcess 环境中设置 `DSH_HOME` 与 `DSH_AGENTS_HOME`。因此会话、设置、凭据、profile 文件、插件安装、存储与 agent 配置位于桌面应用的 Electron `userData/runtime` 目录，不会改变 Web 或 CLI home。Electron main 持有 Chromium 状态与同级桌面日志目录。

renderer 从特权标准协议 `dsh://app` 加载。`/api` 与 `/plugins` 请求经 UtilityProcess 消息端口传输；此 profile 不会创建 TCP 监听器。

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
