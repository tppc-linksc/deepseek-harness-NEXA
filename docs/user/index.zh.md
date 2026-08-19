---
layout: home
title: DeepSeek Harness 桌面版
titleTemplate: false
description: 完整保留 DeepSeek 官方 Harness Web UI 与 agent 运行时，并提供适用于 macOS、Windows 和 Linux 的非官方桌面 App。
---

# DeepSeek Harness

[English](index.md) | 中文

<main class="nexa-site">
<nav class="nexa-product-nav" aria-label="桌面版导航"><a class="nexa-product-name" href="#top"><strong>DeepSeek Harness</strong><span>桌面版</span></a><div><a href="#experience">体验</a><a href="#inside">实现</a><a class="nexa-nav-download" href="#download">下载</a></div></nav>

<header id="top" class="nexa-hero" aria-labelledby="nexa-hero-title">
<div class="nexa-hero-copy">
<p class="nexa-eyebrow">DeepSeek NEXA</p>
<h2 id="nexa-hero-title">完整的 Harness。<br><em>现在，是一个 App。</em></h2>
<p class="nexa-hero-lead">官方 Web UI、插件系统与 agent 运行时完整进入桌面。<br>不需要额外终端，也不启动本地 Web 服务。</p>
<div class="nexa-actions"><a class="nexa-button nexa-button-primary" href="#download">免费下载</a><a class="nexa-button nexa-button-link" href="https://github.com/tppc-linksc/deepseek-harness-NEXA">查看 GitHub <span aria-hidden="true">↗</span></a></div>
<p class="nexa-availability">适用于 macOS、Windows 与 Linux · 0.1.0-rc.6</p>
</div>

<div class="nexa-product-stage" aria-label="DeepSeek Harness 桌面 App 界面示意">
<div class="nexa-stage-halo" aria-hidden="true"></div>
<div class="nexa-product-window">
<div class="nexa-window-bar"><span class="nexa-window-controls" aria-hidden="true"><i></i><i></i><i></i></span><strong>DeepSeek Harness</strong><span class="nexa-window-state"><i aria-hidden="true"></i>Host 已就绪</span></div>
<div class="nexa-window-content">
<aside class="nexa-app-sidebar"><div class="nexa-app-brand"><span aria-hidden="true">◒</span><strong>deepseek</strong><small>HARNESS</small></div><button tabindex="-1"><span aria-hidden="true">＋</span> 新会话</button><p>工作区 <span aria-hidden="true">⌕　＋</span></p><div class="nexa-workspace"><span aria-hidden="true">▱</span><strong>DeepSeek-NEXA</strong></div><div class="nexa-session"><i aria-hidden="true"></i>桌面版产品体验</div><div class="nexa-app-settings"><span aria-hidden="true">⚙</span> 设置</div></aside>
<section class="nexa-app-canvas"><span class="nexa-official-badge"><i aria-hidden="true"></i>官方 Web UI</span><div class="nexa-app-welcome"><span class="nexa-orbit" aria-hidden="true"><i></i></span><h3>探索未至之境</h3><p>选择工作区，开始一个新会话</p><div class="nexa-context"><span>▱ DeepSeek-NEXA</span><span>标准模式⌄</span></div><div class="nexa-prompt"><span>输入任务，或使用 @ 添加上下文</span><i aria-hidden="true"></i><b aria-hidden="true">↑</b></div></div><div class="nexa-canvas-status"><span><i aria-hidden="true"></i>Renderer connected</span><span>0 open ports</span></div></section>
</div>
</div>
<div class="nexa-stage-caption"><span>官方界面</span><i aria-hidden="true"></i><strong>私有进程 IPC</strong><i aria-hidden="true"></i><span>Harness Host</span></div>
</div>

<p class="nexa-disclosure"><strong>非官方社区桌面封装。</strong>DeepSeek AI 维护<a href="https://github.com/deepseek-ai/deepseek-harness">官方 Harness</a>；本 fork 只维护 App 外壳与安装包。</p>
</header>

<section id="experience" class="nexa-experience" aria-labelledby="nexa-experience-title">
<div class="nexa-section-copy"><p class="nexa-section-label">使用体验</p><h2 id="nexa-experience-title">打开。选择工作区。<br><em>开始。</em></h2><p>桌面版把窗口和 Harness Host 一起启动。没有浏览器地址、端口配置或需要一直挂着的终端。</p></div>
<div class="nexa-experience-visual" aria-hidden="true"><div class="nexa-app-icon"><span>◒</span></div><div class="nexa-flow-line"><i></i><i></i><i></i></div><div class="nexa-mini-window"><div><i></i><i></i><i></i></div><span>DeepSeek Harness</span><strong>准备就绪</strong></div></div>
<div class="nexa-facts"><div><strong>一次点击</strong><span>App 与 Host 同时启动</span></div><div><strong>零监听端口</strong><span>界面通过私有 IPC 通信</span></div><div><strong>独立状态</strong><span>不占用 Web UI 的目录与会话</span></div></div>
</section>

<section id="inside" class="nexa-inside" aria-labelledby="nexa-inside-title">
<div class="nexa-inside-copy"><p class="nexa-section-label">里面仍是官方 Harness</p><h2 id="nexa-inside-title">熟悉的一切，<br>一项都没有少。</h2><p>项目、会话、插件、工具与 agent 运行时仍由官方 Harness 提供。桌面层只处理应用生命周期、原生安装和私有进程通信。</p><a href="https://github.com/deepseek-ai/deepseek-harness">查看官方上游 <span aria-hidden="true">↗</span></a></div>
<div class="nexa-inside-visual" aria-label="官方 Harness 与桌面外壳关系"><div class="nexa-runtime-card"><small>OFFICIAL</small><strong>DeepSeek Harness</strong><p>Web UI · Plugins · Agent Runtime</p></div><div class="nexa-private-link"><span></span><strong>private IPC</strong><span></span></div><div class="nexa-shell-card"><small>NEXA</small><strong>Desktop shell</strong><p>Lifecycle · Installers · Isolated state</p></div></div>
</section>

<section id="download" class="nexa-downloads" aria-labelledby="nexa-download-title">
<div class="nexa-download-intro"><p class="nexa-section-label">免费下载</p><h2 id="nexa-download-title">选好系统。<br>打开新世界。</h2><p>当前版本 0.1.0-rc.6。安装包由 GitHub Releases 提供。</p></div>
<div class="nexa-download-list">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-mac-arm64.dmg"><span class="nexa-platform-icon nexa-platform-icon-apple" aria-hidden="true"></span><span><strong>macOS</strong><small>Apple Silicon · DMG</small></span><b>下载 <i aria-hidden="true">↓</i></b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-win-x64.exe"><span class="nexa-platform-icon nexa-platform-icon-windows" aria-hidden="true"></span><span><strong>Windows</strong><small>Windows 10+ · x64 · EXE</small></span><b>下载 <i aria-hidden="true">↓</i></b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/DeepSeek-NEXA-0.1.0-rc.6-linux-x64.AppImage"><span class="nexa-platform-icon nexa-platform-icon-linux" aria-hidden="true"></span><span><strong>Linux</strong><small>x86_64 · AppImage</small></span><b>下载 <i aria-hidden="true">↓</i></b></a>
</div>
<p class="nexa-signing-note">macOS 与 Windows 版本没有商业代码签名，首次启动可能出现系统安全提示。<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/nexa-v0.1.0-rc.6">查看发布说明</a><span>·</span><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/nexa-v0.1.0-rc.6/SHA256SUMS.txt">SHA-256 校验</a></p>
</section>

<section class="nexa-source" aria-labelledby="nexa-source-title"><div><p class="nexa-section-label">从源码运行</p><h2 id="nexa-source-title">两条命令，启动桌面版。</h2><p>克隆本 fork，并安装仓库支持的 Node.js 与 pnpm 版本。</p></div><pre aria-label="从源码运行指令"><code><span>$</span> pnpm install
<span>$</span> pnpm run start:desktop</code></pre></section>

<footer class="nexa-footer"><div><strong>DeepSeek Harness</strong><span>Desktop by NEXA</span></div><nav><a href="https://github.com/deepseek-ai/deepseek-harness">官方上游</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">桌面 fork</a><a href="./guide/quickstart">使用文档</a></nav><small>非官方社区桌面封装 · 2026</small></footer>
</main>
