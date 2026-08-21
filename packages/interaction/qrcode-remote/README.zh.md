# @deepseek-ai/dsh-qrcode-remote

[English](README.md) | 中文

DeepSeek Harness NEXA 与 NEXA Remote 的 Host 端集成。Web 与桌面组合将它挂载为 `qrcode-remote` Cordis 条目，因此它会出现在“**运行组件 → 组件清单**”中。它负责电脑身份、加密通道对端密钥、Relay 连接、配对二维码生命周期、远程指令适配，以及独立“**远程操控**”设置菜单使用的 `remoteControl` Typert 命名空间。

电脑始终是权威端。手机指令通过 `ctx.apiProxy.sessions.prompt` 进入，与本地界面走同一套准入路径，并在目标 Agent 空闲后返回最终状态。DSH 的审批请求通过既有 `approval/request` waterfall 交给已配对手机；手机不可用时继续交由本地响应器处理，手机允许也只能产生一次性授权 `allowed-once`。

## 配置

| 键 | 含义 |
|---|---|
| `statePath` | 必填的私有 JSON 状态路径，保存电脑身份、偏好和加密通道对端密钥；文件权限为 `0600`。 |
| `enabled` | 尚无状态文件时采用的初始连接开关，默认 `true`。 |
| `relayUrl` | 托管的 `ws://` 或 `wss://` Relay 地址，默认固定生产端点 `wss://relay.tppc.top`。 |
| `allowCustomRelay` | 为 `true` 时才在设置中开放 Relay 编辑；默认 `false`，仅用于本地开发或自托管。 |
| `computerName` | 配对二维码中显示的初始电脑名称。 |

生成的 Remote 提供 `state`、`configure`、`reconnect`、`openPairing`、`confirmPairing` 和 `revoke`。任何方法都不会返回私钥。托管模式会忽略浏览器提交的 Relay 变更，也不会显示地址编辑器。连接就绪后，设置会自动调用 `openPairing`，并在要约过期后自动刷新。Relay 配置仅服务端可见的微信密钥后，要约会成为可直接使用微信扫描的小程序码；开发环境则回退到旧 `NEXA:` 二维码。两种模式均在五分钟后过期，并且仍须在电脑端明确确认。

## 模型体验

间接产生影响：通过 Host 准入边界验证的手机动作会进入普通 Session 输入或既有审批服务。

#### KV Cache 影响

本包不拥有请求前缀；已准入的 Session 消息与审批结果遵循其既有消费方的缓存行为。

## 已知限制与延期工作

- 本地状态文件已限制权限，但尚未接入 Keychain、DPAPI 或其他操作系统安全存储。
- 微信真机网络、小程序审核与 SOTER 生物审批仍是本 Host 包之外的发布门禁。
- 公网 Relay 需要 TLS 终止和持久化 Redis 配置。本地 Relay 测试必须显式设置 `DSH_REMOTE_RELAY_URL=ws://127.0.0.1:8080` 与 `DSH_REMOTE_ALLOW_CUSTOM_RELAY=1`。
