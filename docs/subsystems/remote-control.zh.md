# 远程操控

[English](remote-control.md) | 中文

[dsh-qrcode-remote](../../packages/interaction/qrcode-remote) 提供可选启用的 NEXA Remote 桥，把已配对的微信小程序变成一台电脑的应用级控制端。它可以查看会话、追加或停止任务、回答待处理审批、在电脑新建会话、把电脑项目目录注册为工作区，以及修改明确允许远程修改的设置，而无需创建第二套 agent 运行时。电脑仍是唯一执行权威：所有会话、Agent 循环、模型调用、项目、设置与工具操作都由电脑持有；小程序不会在本地执行，也不会成为第二事实源。

源码：[`packages/interaction/qrcode-remote/src/index.ts`](../../packages/interaction/qrcode-remote/src/index.ts)

## 连接、配对与持久化

`RemoteControlService` 持有一个 NEXA `RemoteHost`，并通过 `remoteControl` Typert 命名空间公开安全的控制面。Relay 只路由不透明帧；通过 X25519 派生且经过身份认证的对端通道对应用消息进行端到端加密。生产环境固定使用且不在 UI 显示 `wss://relay.tppc.top`，只有显式开发配置才能改用自定义地址。`qrcode-remote` 仍会出现在运行组件清单中，但产品入口只保留 `sidebar.footer.trailing` 中紧邻“设置”右侧的“连接移动端”小图标。打开该图标会建立一个短时、单次的电脑授权窗口并显示有时效的微信小程序码；微信用随机 `scene` 换取签名 challenge，手机提交 proposal，电脑在后台对精确匹配的 challenge 签名确认，然后小程序直接打开最近的桌面会话。Relay 地址、电脑 ID、指纹、设备列表、重连按钮、小程序内扫码、二次确认和“进入会话”都不属于常规产品流程。

连接状态以 Host 完成身份认证的传输为准。Relay 意外断开后，服务会按有上限的指数退避自动重试；请求配对窗口时会重启已经失效的 Host；成功刷新状态后会清除浏览器端短时错误。因此网络变化后入口仍能自行恢复，而无需向用户暴露手动 Relay 控制台。

Host 通过原子替换把电脑身份、加密通道对端密钥、偏好与撤销标记写入所配置的 `statePath`，随后强制文件权限为 `0600`。`RemoteControlState` 与 `RemoteControlPairingOffer` 是浏览器安全投影：两者都不会返回身份私钥或对端通道密钥。因此侧边栏浮层只是窄连接界面，不是密码学身份所有者或设备管理控制台。

## 应用控制边界

手机不会直接调用 Agent 实现。`DshRemoteHarnessAdapter` 把 `session.append_instruction` 映射到 `ctx.apiProxy.sessions.prompt`，把 `session.stop` 映射到 Session 取消 API，把 `session.create` 映射到 `ctx.apiProxy.sessions.create`。每次修改都使用带幂等键的版本化控制请求；Host 会为重试回放已完成结果，并发布电脑产生的新快照，不允许手机预判成功。会话事件与有界快照通过加密的 NEXA 通道返回，因此 Host 仍是会话事实的唯一来源。快照包含每个未归档的桌面会话，包括刚创建的空白会话；只有已归档会话和 subagent 会话不进入移动端主列表。

该投影沿用桌面信息层级，而不暴露协议噪音。移动侧栏只显示当前电脑名称、在线状态以及工作区/会话树；不重复头像、产品说明或“远程镜像/连接电脑”模式，也不提供占位关闭按钮，点击遮罩或向左滑动即可收起。用户与 Agent 消息直接渲染；工具事件提供紧凑动作以及具体命令、文件或测试目标，参数、过程与结果在用户打开卡片前保持折叠，Markdown 结果使用安全渲染子集。电脑的 `running` 字段驱动手机输入栏在发送与停止之间切换；手机停止请求只有在电脑返回 Session 取消结果后才成为权威状态。历史页按编码后的字节预算控制在 Relay 帧上限以内，大型工具输出带明确截断标记并用 `hasMore` 继续分页。已认证的快照、历史页或实时帧也会覆盖延迟的离线 Presence，避免正常同步的会话被误标为正在重连。

## 工作区与设置控制

只有适配器真实实现后，Host 才会发布 `workspace.roots.list`、`workspace.directory.list`、`workspace.register` 和 `workspace.create`。目录结果只包含显示名和短时不透明引用，不包含绝对路径。每次请求都会重新解析引用，证明规范目录仍位于同一设备的授权根下，并拒绝符号链接、挂载逃逸、隐藏或敏感目录、路径穿越、嵌套创建和非法名称。P0 明确不提供移动、重命名、删除、上传或任意文件读写；创建失败时，仅在新目录仍为空的情况下回滚。

Host 通过 `settings.get` 与 `settings.update` 发布设置类型、风险、当前值和是否允许远程修改的描述符。P0 允许修改电脑名称，而 Relay 配置、凭据、授权根、安全开关和模型配置仍仅限电脑本地修改。更新请求包含期望的 `settings_revision` 和提交设置的摘要；电脑拒绝过期、未知、摘要不匹配或不允许的写入，并先持久化新修订号，再由手机刷新投影。

## 审批回退

桥接层在既有 `approval/request` waterfall 前端注册一个应答者。只有未撤销且已配对的手机处于连接状态时，它才会认领请求；否则调用下一个本地应答者。远程允许被归一化为既有的一次性 `allowed-once` 结果，因此配对不会削弱 DSH 审批策略，也不会产生持久权限。策略执行与审计事件仍由审批服务负责。

## 发布边界

除非用 `DSH_REMOTE_ENABLED=1` 写入首次运行偏好，否则 bundle 默认禁用此功能。公网部署必须在托管 Relay 后提供持久 Redis 状态与微信服务端密钥。本地测试设置 `DSH_REMOTE_RELAY_URL=ws://127.0.0.1:8080` 和 `DSH_REMOTE_ALLOW_CUSTOM_RELAY=1`。当前状态文件已限制权限，但尚未写入 Keychain、DPAPI 或其他操作系统安全存储；微信真机网络与 SOTER 生物审批仍是发布门禁。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxremotecontrol--remotecontrolservice"></a>

### `ctx.remoteControl` — `RemoteControlService`

Host-owned remote connection, pairing state, and typed settings actions.

```ts cordis-catalog
/**
 * Project the current control plane without private key material.
 * @returns current browser-safe connection, pairing, and device state.
 */
@Remote('state') state(): RemoteControlState

/**
 * Persist preferences and restart the Relay connection.
 * @param request - complete replacement preference set from settings.
 * @returns state after the restart attempt settles.
 */
@Remote('configure') async configure(request: RemoteControlConfigureRequest): Promise<RemoteControlState>

/**
 * Retry the currently configured Relay immediately.
 * @returns state after an explicit Relay reconnection attempt settles.
 */
@Remote('reconnect') async reconnect(): Promise<RemoteControlState>

/**
 * Open a computer-side pairing window and authorize only that fresh challenge.
 * @returns expiring Mini Program payload and rendered QR data URL.
 */
@Remote('openPairing') async openPairing(): Promise<RemoteControlPairingOffer>

/**
 * Accept the phone proposal currently visible to the user.
 * @returns state after confirming the currently pending phone proposal.
 */
@Remote('confirmPairing') confirmPairing(): RemoteControlState

/**
 * Revoke one known phone and persist the invalidated peer.
 * @param request - device identity selected in settings.
 * @returns state containing the revoked device marker.
 */
@Remote('revoke') revoke(request: RemoteControlRevokeRequest): RemoteControlState
```

Source: [`packages/interaction/qrcode-remote/src/index.ts:667`](../../packages/interaction/qrcode-remote/src/index.ts)
<!-- END GENERATED cordis-surface -->
