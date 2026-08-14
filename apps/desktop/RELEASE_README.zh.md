# ⚠️ 非官方 DeepSeek Harness 桌面封装

[English](RELEASE_README.md) | 中文

> **这不是 DeepSeek 官方发布。** 本 fork 把官方 DeepSeek Harness Web UI 与 agent 运行时封装到 Electron 应用外壳中。安装包不由 DeepSeek AI 发布或提供支持。

## 此版本包含什么

桌面应用复用官方 Web UI，而不是重新实现界面。Electron 在子 UtilityProcess 中启动 Harness Host，并通过私有进程协议传递请求；它不会启动 HTTP server，也不会暴露 TCP 监听端口。桌面会话、设置、凭据、插件、Chromium 状态和日志使用桌面专属应用数据目录，不与正在运行的 Web profile 共用可写文件。

## 下载

- macOS Apple Silicon：`DeepSeek-Harness-*-mac-arm64.dmg`
- Windows x64：`DeepSeek-Harness-*-win-x64.exe`
- Linux x64：`DeepSeek-Harness-*-linux-x64.AppImage`

## 安装

### macOS

由于本 fork 没有 Apple Developer 账号，DMG 仅使用 ad-hoc 签名，且未经过公证。请把应用拖到「应用程序」。如果 macOS 阻止首次启动，请打开「系统设置」→「隐私与安全性」，然后选择「仍要打开」。

### Windows

NSIS 安装程序没有 Authenticode 签名。Windows SmartScreen 可能显示未知发布者警告；只有下载文件的 SHA-256 校验和与发布的校验文件一致时才应继续。

### Linux

赋予 AppImage 执行权限后运行：

```sh
chmod +x DeepSeek-Harness-*-linux-x64.AppImage
./DeepSeek-Harness-*-linux-x64.AppImage
```

## 隐私

- 桌面 Host 进程会强制关闭会话遥测。
- 提示词、附件、工具结果及必要请求元数据会发送到用户选择的模型提供方；本应用不是离线模型运行时。
- 桌面载体不会绑定 HTTP 或 TCP 监听端口。
- 会话、凭据、设置和日志保留在平台应用数据目录中；已配置工具经用户批准写入其他位置的情况除外。
- 发布前会扫描安装包中的私钥、常见 API Token 格式、本地绝对路径和仓库 `.env` 内容。

## 校验

打开下载文件前，请把它与同一 Release 中的 `SHA256SUMS.txt` 比对。

## 源码与许可证

源码发布于 [tppc-linksc/deepseek-harness-NEXA](https://github.com/tppc-linksc/deepseek-harness-NEXA)，上游项目为 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)。代码继续使用仓库的 [MIT 许可证](../../LICENSE)，第三方声明见 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。
