# 远程操控

[English](remote-control.md) | 中文

[dsh-qrcode-remote](../../packages/interaction/qrcode-remote) 提供可选启用的 NEXA Remote 桥，让已配对的微信小程序查看会话、追加指令、停止正在执行的任务，或回答待处理审批，而无需创建第二套 agent 运行时。电脑始终是权威端：它持有长期身份与对端记录，请求 Relay 生成有时效且可扫码直达的小程序码，确认手机指纹，通过既有 Session API 接纳指令，并可随时撤销手机。

源码：[`packages/interaction/qrcode-remote/src/index.ts`](../../packages/interaction/qrcode-remote/src/index.ts)

## 连接、配对与持久化

`RemoteControlService` 持有一个 NEXA `RemoteHost`，并通过 `remoteControl` Typert 命名空间公开安全的控制面。Relay 只路由不透明帧；通过 X25519 派生且经过身份认证的对端通道对应用消息进行端到端加密。生产环境固定使用且不在 UI 显示 `wss://relay.tppc.top`，只有显式开发配置才能改用自定义地址。连接后，设置会自动请求并刷新配对要约。要约请求 Relay 生成只包含随机短 `scene` 的微信小程序码；微信扫码后直接打开配对页，由页面用 `scene` 换取电脑签名且会过期的 `NEXA:` 挑战。仅服务端微信密钥不可用时，设置才会带标签地渲染旧载荷供小程序内扫码。扫码并不足以配对：设置会显示发起请求的手机指纹，只有电脑端明确确认后，手机才成为可信对端。

Host 通过原子替换把电脑身份、加密通道对端密钥、偏好与撤销标记写入所配置的 `statePath`，随后强制文件权限为 `0600`。`RemoteControlState` 与 `RemoteControlPairingOffer` 是浏览器安全投影：两者都不会返回身份私钥或对端通道密钥。因此设置界面只是控制面，不是密码学身份的所有者。

## 指令与事件边界

手机不会直接调用 Agent 实现。`DshRemoteHarnessAdapter` 把 `append_instruction` 映射到采用队列准入的 `ctx.apiProxy.sessions.prompt`，把 `stop` 映射到 Session 取消 API；它拒绝其他所有动作，等待目标 Agent 进入空闲状态，再返回最终接受或拒绝结果。会话事件与有界快照通过加密的 NEXA 通道返回，因此 Host 仍是会话事实的唯一来源。

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
 * Open a computer-side pairing window for the configured name.
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

Source: [`packages/interaction/qrcode-remote/src/index.ts:383`](../../packages/interaction/qrcode-remote/src/index.ts)
<!-- END GENERATED cordis-surface -->
