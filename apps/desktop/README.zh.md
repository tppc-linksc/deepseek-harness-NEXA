# @deepseek-ai/dsh-desktop

dsh Web GUI 的 macOS 桌面壳 —— **方案 A 薄壳**（两期里程碑的第一期）。

整个 harness 一行不改：本应用拉起与浏览器 GUI 完全相同的 `dsh web` 宿主，
等待其 `dsh web: http://127.0.0.1:<port>` 就绪行后，在 Electron 窗口打开该
地址。关闭窗口即停止宿主。

## 运行

一次性准备：

```sh
pnpm install
pnpm run build          # 宿主 lib + Web 前端 dist（dsh web 需要）
```

启动桌面壳：

```sh
pnpm dev:desktop
```

冒烟运行（无需构建 harness —— 使用 `scripts/fake-host.mjs`，页面加载完成后自动退出）：

```sh
pnpm smoke:desktop
```

## 工作原理

- `src/main.ts` —— Electron 主进程：拉起宿主（仓库根下
  `node apps/cli/lib/bin.js web`；可用 `DSH_DESKTOP_HOST` 覆盖整条命令，
  `DSH_DESKTOP_CWD` 覆盖工作目录），解析就绪行，加载 URL；退出时终止宿主
  （SIGTERM，5 秒后升级 SIGKILL）；只允许导航到宿主 origin。
- `preload.cjs` —— seam 占位，暴露 `window.dshDesktop`（平台 + 版本）。
  **方案 B**（自定义协议加载 dist + 用 IPC 载体替代 /api RPC 与事件流）将把它
  扩展为完整桥接；前端连接层已抽象出 carrier，届时 shell 代码零改动。
- `scripts/fake-host.mjs` —— 仅开发用的 `dsh web` 替身，供冒烟运行。

## 当前范围 vs 方案 B

| | 方案 A（本期） | 方案 B（下一期） |
|---|---|---|
| 传输 | localhost HTTP/WS（原样） | 自定义协议 + IPC 载体 |
| 宿主进程 | 子进程 `dsh web` | 同一宿主图，进程内或内置二进制 |
| 打包 | 暂无 | .app/.dmg、签名、公证 |
| 现有代码改动 | 无 | 仅载体选择 |
## 排障

- **Node ≥ 26 下报 `Electron failed to install correctly`** — electron 的
  postinstall（extract-zip@2.0.1）在 Node 26 下只解压出部分文件。上游修复前，
  手动补齐一次二进制：

  ```sh
  cd node_modules/.pnpm/electron@40.9.3/node_modules/electron
  rm -rf dist && mkdir dist
  unzip -qo ~/Library/Caches/electron/electron-v40.9.3-darwin-arm64.zip -d dist
  printf 'Electron.app/Contents/MacOS/Electron' > path.txt
  ```

  （若版本升级过，请同步修改路径中的版本号。）

## 打包

```sh
pnpm pack:desktop            # 产出 .app + .dmg 到 apps/desktop/dist/
```

或在包目录内 `npm run pack`（含 dmg）/`npm run pack:dir`（仅 .app）。流水线：

1. `tsc` 构建壳（`lib/`）。
2. `scripts/package-host.mjs` 把 dsh CLI 闭包部署到 `host/`：
   - `pnpm deploy --legacy`（越界链接修复与 peer/bootstrap 物化都在脚本内完成，
     脚本头部注释记录了 pnpm 的若干坑）；
   - 复制自包含 node 二进制为 `host/node`；
   - 真实启动一次宿主，物化 deploy 遗漏的包。
3. `electron-builder --dir` 打包应用壳（host 太大且符号链接密集，
   electron-builder 自己的拷贝处理不了——见 `scripts/finish-app.mjs`）。
4. `scripts/finish-app.mjs` 注入 `host/` 到 `Contents/Resources/host`，
   可选 `hdiutil` 出 dmg。

签名：本地构建为 ad-hoc（无身份）。分发需在 electron-builder.yml 设置
`CSC_LINK`/`CSC_KEY_PASSWORD`（或 `mac.identity`）并移除 `identity: null`。

前置条件：先执行 `pnpm run build`（宿主 lib + Web 前端 dist）。
