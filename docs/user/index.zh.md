---
layout: home
title: DeepSeek Harness 桌面版
titleTemplate: false
description: 完整保留 DeepSeek 官方 Harness Web UI 与 agent 运行时，并提供适用于 macOS、Windows 和 Linux 的非官方桌面 App。
---

# DeepSeek Harness

[English](index.md) | 中文

<main class="nexa-site">
<header class="nexa-hero" aria-labelledby="nexa-hero-title">
<div class="nexa-hero-grid" aria-hidden="true"></div>
<div class="nexa-topline"><a class="nexa-brand" href="https://github.com/deepseek-ai/deepseek-harness"><span class="nexa-brand-mark" aria-hidden="true"></span><span>deepseek harness</span></a><div><span class="nexa-edition">NEXA 桌面封装</span><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">GitHub <span aria-hidden="true">↗</span></a></div></div>
<div class="nexa-hero-layout">
<div class="nexa-hero-copy">
<p class="nexa-kicker"><span aria-hidden="true"></span>Desktop RC 05 · macOS / Windows / Linux</p>
<h2 id="nexa-hero-title">完整 Harness，<br><em>桌面打开。</em></h2>
<p class="nexa-hero-lead">官方 Web UI、插件系统与 agent 运行时原样进入桌面 App。无需另开终端，也不启动本地 Web 服务。</p>
<div class="nexa-hero-actions"><a class="nexa-primary-action" href="#download"><span>选择系统下载</span><i aria-hidden="true">↓</i></a><a class="nexa-secondary-action" href="https://github.com/tppc-linksc/deepseek-harness-NEXA">查看源码 <span aria-hidden="true">↗</span></a></div>
<p class="nexa-hero-disclosure"><strong>非官方社区桌面封装</strong> · DeepSeek AI 维护<a href="https://github.com/deepseek-ai/deepseek-harness">官方 Harness</a>；本 fork 只维护 App 外壳与安装包。</p>
</div>
<div class="nexa-workbench" aria-label="DeepSeek Harness 桌面界面示意">
<div class="nexa-glow-orbit" aria-hidden="true"></div>
<div class="nexa-app-window">
<div class="nexa-titlebar"><span class="nexa-window-dots" aria-hidden="true"><i></i><i></i><i></i></span><strong>DeepSeek Harness</strong><span class="nexa-host-ready"><i aria-hidden="true"></i>Host ready</span></div>
<div class="nexa-app-body">
<aside class="nexa-app-sidebar">
<div class="nexa-app-logo"><span class="nexa-mini-mark" aria-hidden="true"></span><b>deepseek</b><small>HARNESS</small></div>
<div class="nexa-new-session"><span aria-hidden="true">＋</span> 新会话</div>
<div class="nexa-side-heading"><span>工作区</span><span aria-hidden="true">⌕　＋</span></div>
<div class="nexa-workspace-row"><span aria-hidden="true">◇</span><b>DeepSeek-NEXA</b></div>
<div class="nexa-session-row"><i aria-hidden="true"></i><span>桌面端产品体验</span></div>
<div class="nexa-settings-row"><span aria-hidden="true">⚙</span> 设置</div>
</aside>
<section class="nexa-app-main">
<div class="nexa-official-chip"><i aria-hidden="true"></i>官方 Web UI</div>
<div class="nexa-app-center"><span class="nexa-agent-mark" aria-hidden="true"><i></i></span><h3>探索未至之境</h3><p>选择工作区，开始一个新会话</p><div class="nexa-context-row"><span>▱ DeepSeek-NEXA</span><span>标准模式⌄</span></div><div class="nexa-composer"><span>输入任务，或使用 @ 添加上下文</span><i class="nexa-caret" aria-hidden="true"></i><button aria-label="发送示意" tabindex="-1">↑</button></div></div>
<div class="nexa-app-status"><span><i aria-hidden="true"></i>Renderer connected</span><span>0 open ports</span></div>
</section>
</div>
</div>
<div class="nexa-ipc-rail"><div><small>Electron renderer</small><strong>官方界面</strong></div><span><i aria-hidden="true"></i><b>私有进程 IPC</b><i aria-hidden="true"></i></span><div><small>UtilityProcess</small><strong>Harness Host</strong></div></div>
</div>
</div>
<div class="nexa-quick-downloads" aria-label="快速下载"><div><span>当前版本</span><strong>0.1.0-rc.5</strong></div><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg"><span class="nexa-os-code">MAC</span><span><strong>macOS</strong><small>Apple Silicon · DMG</small></span><i aria-hidden="true">↓</i></a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe"><span class="nexa-os-code">WIN</span><span><strong>Windows</strong><small>x64 · NSIS EXE</small></span><i aria-hidden="true">↓</i></a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage"><span class="nexa-os-code">LNX</span><span><strong>Linux</strong><small>x86_64 · AppImage</small></span><i aria-hidden="true">↓</i></a></div>
</header>

<section class="nexa-experience" aria-labelledby="nexa-experience-title">
<div class="nexa-section-intro"><p class="nexa-label">UI / UX First</p><h2 id="nexa-experience-title">打开 App，<br>直接开始任务。</h2><p>桌面版保留官方产品体验，只移除浏览器、端口与手动启动服务这些额外步骤。</p></div>
<ol class="nexa-journey"><li><span>01</span><div class="nexa-step-visual nexa-step-launch" aria-hidden="true"><i></i><b>Harness</b></div><h3>打开 App</h3><p>窗口和 Host 随应用一起启动，不需要外挂终端。</p></li><li><span>02</span><div class="nexa-step-visual nexa-step-workspace" aria-hidden="true"><i></i><b>DeepSeek-NEXA</b><small>Workspace ready</small></div><h3>选择工作区</h3><p>继续使用官方工作区、插件与工具组合。</p></li><li><span>03</span><div class="nexa-step-visual nexa-step-session" aria-hidden="true"><i></i><b>开始新会话</b><small>Host connected</small></div><h3>开始会话</h3><p>界面通过私有 IPC 连接 Host，不监听 HTTP 端口。</p></li></ol>
</section>

<section class="nexa-integrity" aria-labelledby="nexa-integrity-title">
<div class="nexa-integrity-copy"><p class="nexa-label">同一个 Harness</p><h2 id="nexa-integrity-title">App 外壳之外，<br>仍是官方 Harness。</h2><p>项目、会话、插件、工具与 agent 运行时没有复制一套。桌面端只负责应用生命周期、私有进程通信和原生安装体验。</p><a href="https://github.com/deepseek-ai/deepseek-harness">查看官方上游 <span aria-hidden="true">↗</span></a></div>
<div class="nexa-layer-stack" aria-label="桌面端技术分层"><div class="nexa-layer nexa-layer-official"><span>OFFICIAL</span><div><strong>DeepSeek Harness</strong><small>Web UI · Plugins · Agent Runtime</small></div><i>完整保留</i></div><div class="nexa-layer-connector"><span>private IPC</span></div><div class="nexa-layer nexa-layer-desktop"><span>NEXA</span><div><strong>Desktop shell</strong><small>Lifecycle · Installers · Isolated state</small></div><i>本 fork</i></div><div class="nexa-proof-strip"><span><strong>0</strong> 监听端口</span><span><strong>1</strong> 独立数据目录</span><span><strong>3</strong> 桌面平台</span></div></div>
</section>

<section id="download" class="nexa-downloads" aria-labelledby="nexa-download-title">
<div class="nexa-download-heading"><p class="nexa-label">Release 0.1.0-rc.5</p><h2 id="nexa-download-title">选好系统，<br>直接开始。</h2><p>安装包由 GitHub Releases 提供。macOS 与 Windows 版本没有商业代码签名，首次启动时可能出现系统安全提示。</p><div><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">发布说明 ↗</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/SHA256SUMS.txt">SHA-256 校验 ↗</a></div></div>
<div class="nexa-download-list">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg"><span class="nexa-installer-index">01</span><span class="nexa-installer-platform"><i>MAC</i><strong>macOS</strong></span><span class="nexa-installer-spec">Apple Silicon</span><span class="nexa-installer-format">DMG · ad-hoc 签名</span><b>下载 <i aria-hidden="true">↓</i></b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe"><span class="nexa-installer-index">02</span><span class="nexa-installer-platform"><i>WIN</i><strong>Windows</strong></span><span class="nexa-installer-spec">Windows 10+ · x64</span><span class="nexa-installer-format">NSIS EXE · 未签名</span><b>下载 <i aria-hidden="true">↓</i></b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage"><span class="nexa-installer-index">03</span><span class="nexa-installer-platform"><i>LNX</i><strong>Linux</strong></span><span class="nexa-installer-spec">Linux · x86_64</span><span class="nexa-installer-format">免安装 AppImage</span><b>下载 <i aria-hidden="true">↓</i></b></a>
</div>
</section>

<section class="nexa-source" aria-labelledby="nexa-source-title"><div><p class="nexa-label">From source</p><h2 id="nexa-source-title">也可以从源码启动。</h2><p>克隆桌面 fork，安装仓库支持的 Node.js 与 pnpm 版本后运行：</p></div><pre aria-label="从源码运行指令"><code><span>$</span> pnpm install
<span>$</span> pnpm run start:desktop</code></pre></section>

<footer class="nexa-footer"><div><span class="nexa-brand-mark" aria-hidden="true"></span><div><strong>DeepSeek Harness / NEXA</strong><p>官方开源 Harness 的非官方桌面封装。</p></div></div><nav><a href="https://github.com/deepseek-ai/deepseek-harness">官方上游</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">桌面 fork</a><a href="./guide/quickstart">使用文档</a></nav><small>Community desktop edition · 2026</small></footer>
</main>
