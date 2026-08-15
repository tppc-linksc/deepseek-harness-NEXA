# ⚠️ 非官方 DeepSeek Harness 桌面封装

[默认中文](README.md) | [English](README.en.md) | 中文

> **本 fork 不是 DeepSeek 官方发布。** 它保留官方 DeepSeek Harness 的 Web UI 与 agent 运行时，只增加 Electron 应用外壳和原生安装包。此仓库中的安装包不由 DeepSeek AI 发布或提供支持。

访问[项目官网](https://www.deepseek-nexa.com)，或从本 fork 的 [GitHub Releases](https://github.com/tppc-linksc/deepseek-harness-NEXA/releases) 下载未签名桌面版本。安装前请阅读[桌面发布说明](apps/desktop/RELEASE_README.md)。

## 上游项目

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

<a id="run"></a>

## 运行

<a id="run-from-source"></a>

### 从源码运行桌面 App

安装本仓库支持的 Node.js 与 pnpm 版本，然后运行：

```sh
git clone https://github.com/tppc-linksc/deepseek-harness-NEXA.git
cd deepseek-harness-NEXA
pnpm install
pnpm run start:desktop
```

`start:desktop` 会构建共享运行时和 Web 客户端资源，然后直接打开 Electron 桌面窗口。进程会占用当前终端，按 `Ctrl+C` 即可退出。桌面 App 不会执行 `dsh web`、打开浏览器或监听 HTTP 端口。

如果依赖和源码没有变化，已构建的 App 可以直接重新启动：

```sh
pnpm --filter @deepseek-ai/dsh-desktop start
```

修改源码后请再次运行 `pnpm run start:desktop`，以便重新构建后再启动。桌面形态会把会话、设置、凭据、插件、agent 配置、Chromium 状态和日志存放在自己的 Electron 应用数据目录中，不会复用正在运行的 Web profile 的 Harness home。

### 在本机生成桌面安装包

在对应目标系统的仓库根目录运行：

```sh
pnpm run package:desktop:current
```

生成的 DMG、NSIS EXE 或 AppImage 位于 `dist/installers`。运行时包含平台原生依赖，因此应在 macOS、Windows 或 Linux 上分别构建对应平台的安装包。

### 运行 Web UI

如需运行上游 Web UI，可以直接使用 npm 包：

```sh
npx @deepseek-ai/dsh web
```

也可以从当前源码构建并运行：

```sh
pnpm run build
pnpm dsh web
```

Web UI 默认监听 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
