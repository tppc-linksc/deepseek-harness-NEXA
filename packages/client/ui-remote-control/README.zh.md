# @deepseek-ai/dsh-client-ui-remote-control

[English](README.md) | 中文

`@deepseek-ai/dsh-qrcode-remote` 的浏览器端设置界面。它向 `settings.section` 注册“**远程操控**”，所有 Host 操作都通过生成的 `remoteControl` Remote 命名空间完成。

该页面显示 Relay 状态与非敏感的电脑 ID，可修改启用开关和电脑名称；Relay 连接后会自动生成并刷新供微信直接扫描的短时小程序码，也可在电脑上确认待配对手机和解除已配对手机。托管生产端点不会显示或允许编辑，只有 Host 显式开启开发标志时，本地与自托管测试才会出现 Relay 输入框。只有 Relay 无法生成微信码时才会显示带明确标签的小程序内扫码兜底。页面只在挂载期间轮询。长期私钥与会话密钥不会穿过 Remote 边界。

## 模型体验

无。浏览器控件不注册提示词、schema 或模型上下文；任何独立准入的手机输入均由 Host 服务负责。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

- 页面可以验证和展示 Relay 连接，但不能自动配置 DNS、TLS、Redis 或公网 Relay 部署。
- 二维码配对与微信 SOTER 仍需真机发布验收。
