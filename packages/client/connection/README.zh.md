# @deepseek-ai/dsh-client-connection

[English](README.md) | 中文

Connection 是 GUI 的 wire 消费方与 Host 分发器。客户端插件挂载 `ctx.connection`：一个 API 客户端、当前形态的 loopback 状态、可观察且按 generation 生效的 `hostDescription`，以及单消费方连接循环。握手成功后会在 `onConnected` 之前发布完整的 `host.describe` 值；generation 失效或显式 stop 会清空它。

Host 根入口提供与传输无关的 `ctx.connection.dispatch(request, authority)`，并持有专用 RPC channel 注册表。Typert Remote interceptor 会先认领自己的 `/api` endpoint，未认领请求再回退 API Proxy。逻辑分发器把原生操作、设置与凭据方法、携带草稿凭据的模型发现，以及 agent-preset 创作操作钉在 loopback authority；受信任的非回环 Web authority 只能访问其余方法。这道栅栏是可达性策略，而不是认证。

`./web` 适配器持有浏览器物理载体：用于 unary 与响应调用的 HTTP route 和有界 Fetch 桥，以及 `events.mux` 与 `events.host` 各一条只下行 WebSocket。它在应用 `src/api-request-trust.ts` 的浏览器信任栅栏后，把每个请求归类为 loopback 或 trusted-host。每个 HTTP 或 upgrade 请求的 `Host` 都必须是回环 authority 或已声明的规范 `trustedHosts` authority；如浏览器带有 `Origin`，它必须与该 authority 相同，显式 cross-site Fetch Metadata 会被拒绝。畸形信任条目会让插件加载失败。这些规则由[浏览器信任 Agent Note](../../../.agents/notes/implemented/architecture/2026-07-28-api-browser-trust-boundary.md)与 [WebSocket 下行 Agent Note](../../../.agents/notes/implemented/architecture/2026-08-04-websocket-downlink-carrier.md)负责。

桌面形态选择 `FetchApiClient`：unary 调用、客户端响应与两条 SSE 流都在 `dsh://app` 使用同源 Fetch。Electron main 通过经过校验的 UtilityProcess 消息协议承载每个 Fetch 请求，桌面 Host 桥则按 loopback authority 分发。此路径不使用 WebSocket 或 TCP server。进程边界由[无端口桌面载体 Agent Note](../../../.agents/notes/implemented/architecture/2026-08-14-portless-electron-desktop-carrier.md)负责。

fixture 载体仍是无 server 的 `?fixture` UI 路径，进程内载体则在无网络 I/O 的情况下满足同一协议。平台载体与 `ConnectionController` 属于内部实现；导出的 handle 与 wire 约定保持传输无关。

## 模型体验

无。Connection 只在客户端与 Host 之间搬运已组合的消息；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **History 会恢复未附加的会话**：打开 history 可能创建宿主侧 agent，并增加首次打开的延迟；没有仅从持久化读取的路径。
- **Web 与 desktop 请求会在分发前整体缓冲**：两种载体默认最多允许 160 MiB，按默认 100 MiB 图片总量上限经 base64 膨胀加信封余量得出；该限制同时是单请求的驻留内存上界。
