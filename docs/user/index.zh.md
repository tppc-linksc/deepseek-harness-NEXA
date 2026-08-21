---
layout: home
title: DeepSeek Harness NEXA
titleTemplate: false
description: 完整保留 DeepSeek 官方 Harness Web UI 与 agent 运行时，并提供适用于 macOS、Windows 和 Linux 的非官方桌面 App。
---

# DeepSeek Harness

[English](index.md) | 中文

<main class="nexa-site">
<nav class="nexa-product-nav" aria-label="桌面版导航"><a class="nexa-product-name" href="#top"><strong>DeepSeek Harness NEXA</strong></a><div><a href="#experience">体验</a><a href="#inside">实现</a><a href="#desktop-features">功能</a><a class="nexa-nav-download" href="#download">下载</a></div></nav>

<header id="top" class="nexa-hero" aria-labelledby="nexa-hero-title">
<div class="nexa-hero-copy">
<p class="nexa-eyebrow">社区桌面版</p>
<h2 id="nexa-hero-title">完整的DeepSeek Harness<br><em>现在，不只是WebUI。</em></h2>
<p class="nexa-hero-lead">官方 Web UI、插件系统与 agent 运行时完整进入桌面。<br>不需要额外终端，也不启动本地 Web 服务。</p>
<div class="nexa-actions"><a class="nexa-button nexa-button-primary" href="#download">免费下载</a><a class="nexa-button nexa-button-link" href="https://github.com/tppc-linksc/deepseek-harness-NEXA">查看 GitHub <span aria-hidden="true">↗</span></a></div>
<p class="nexa-availability">适用于 macOS、Windows 与 Linux · 0.1.0-rc.6</p>
</div>

<div class="nexa-product-stage" aria-label="DeepSeek Harness 桌面 App 界面示意">
<div class="nexa-stage-halo" aria-hidden="true"></div>
<div class="nexa-product-window">
<div class="nexa-window-bar"><span class="nexa-window-controls" aria-hidden="true"><i></i><i></i><i></i></span><strong>DeepSeek Harness</strong><span class="nexa-window-state"><i aria-hidden="true"></i>Host 已就绪</span></div>
<div class="nexa-window-content">
<aside class="nexa-app-sidebar"><div class="nexa-app-brand"><span aria-hidden="true">◒</span><strong>deepseek</strong><small>NEXA</small></div><button tabindex="-1"><span aria-hidden="true">＋</span> 新会话</button><p>工作区 <span aria-hidden="true">⌕　＋</span></p><div class="nexa-workspace"><span aria-hidden="true">▱</span><strong>DeepSeek-NEXA</strong></div><div class="nexa-session"><i aria-hidden="true"></i>桌面版产品体验</div><div class="nexa-app-settings"><span aria-hidden="true">⚙</span> 设置</div></aside>
<section class="nexa-app-canvas"><span class="nexa-official-badge"><i aria-hidden="true"></i>官方 Web UI</span><div class="nexa-app-welcome"><span class="nexa-orbit" aria-hidden="true"><i></i></span><h3>探索未至之境</h3><p>选择工作区，开始一个新会话</p><div class="nexa-context"><span>▱ DeepSeek-NEXA</span><span>标准模式⌄</span></div><div class="nexa-prompt"><span>输入任务，或使用 @ 添加上下文</span><i aria-hidden="true"></i><b aria-hidden="true">↑</b></div></div><div class="nexa-canvas-status"><span><i aria-hidden="true"></i>Renderer connected</span><span>0 open ports</span></div></section>
</div>
</div>
<div class="nexa-stage-caption"><span>官方界面</span><i aria-hidden="true"></i><strong>私有进程 IPC</strong><i aria-hidden="true"></i><span>Harness Host</span></div>
</div>

<p class="nexa-disclosure"><strong>非官方社区桌面封装。</strong>DeepSeek AI 维护<a href="https://github.com/deepseek-ai/deepseek-harness">官方 Harness</a>；本 fork 只维护 App 外壳与安装包。</p>
</header>

<section id="experience" class="nexa-experience" aria-labelledby="nexa-experience-title">
<div class="nexa-section-copy"><p class="nexa-section-label">使用体验</p><h2 id="nexa-experience-title">完全原生的DSH体验。</h2><p>桌面版把窗口和 Harness Host 一起启动。没有浏览器地址、端口配置或需要一直挂着的终端。</p></div>
<div class="nexa-experience-visual" aria-hidden="true"><div class="nexa-app-icon"><span>◒</span></div><div class="nexa-flow-line"><i></i><i></i><i></i></div><div class="nexa-mini-window"><div><i></i><i></i><i></i></div><span>DeepSeek Harness</span><strong>准备就绪</strong></div></div>
<div class="nexa-facts"><div><strong>一次点击</strong><span>App 与 Host 同时启动</span></div><div><strong>零监听端口</strong><span>界面通过私有 IPC 通信</span></div><div><strong>独立状态</strong><span>不占用 Web UI 的目录与会话</span></div></div>
</section>

<section id="inside" class="nexa-inside" aria-labelledby="nexa-inside-title">
<div class="nexa-inside-copy"><p class="nexa-section-label">内核仍是官方 Harness</p><h2 id="nexa-inside-title">熟悉的一切，<br>一项都没少。</h2><p>项目、会话、插件、工具与 agent 运行时仍由官方 Harness 提供。桌面层只处理应用生命周期、原生安装和私有进程通信。</p><a href="https://github.com/deepseek-ai/deepseek-harness">查看官方上游 <span aria-hidden="true">↗</span></a></div>
<div class="nexa-inside-visual" aria-label="官方 Harness 与桌面外壳关系"><div class="nexa-runtime-card"><small>OFFICIAL</small><strong>DeepSeek Harness</strong><p>Web UI · Plugins · Agent Runtime</p></div><div class="nexa-private-link"><span></span><strong>private IPC</strong><span></span></div><div class="nexa-shell-card"><small>NEXA</small><strong>Desktop shell</strong><p>Lifecycle · Installers · Isolated state</p></div></div>
</section>

<section id="desktop-features" class="nexa-desktop-features" aria-labelledby="nexa-desktop-features-title">
<div class="nexa-feature-intro"><p class="nexa-section-label">桌面增强</p><h2 id="nexa-desktop-features-title">扩展与更新，<br>都在 App 内完成。</h2><p>社区扩展的管理与桌面版本的维护各有清晰入口，不必离开 Harness 工作流。</p></div>
<div class="nexa-feature-grid">
<article class="nexa-feature-card nexa-extension-card"><div class="nexa-feature-heading"><span class="nexa-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect></svg></span><div><small>社区扩展</small><h3>扩展中心</h3></div></div><p>在同一处发现、下载、安装、备份和管理社区扩展。已安装扩展与当前运行组件分别表达不同状态。</p><div class="nexa-extension-preview" aria-label="扩展中心界面示意"><div class="nexa-preview-tabs"><strong>发现</strong><span>已安装</span><span>备份</span></div><div class="nexa-extension-item"><span class="nexa-extension-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>用量与余额</strong><small>社区扩展</small></span><b>已安装</b></div></div></article>
<article class="nexa-feature-card nexa-update-card"><div class="nexa-feature-heading"><span class="nexa-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66"></path><path d="M20 4v7h-7"></path></svg></span><div><small>桌面发行</small><h3>应用更新</h3></div></div><p>自动检查新版本，也可随时手动查询。当前版本、更新开关和检查结果保持在清晰的三行布局中。</p><div class="nexa-update-preview" aria-label="应用更新界面示意"><div><span>当前版本</span><strong>0.1.0-rc.6</strong></div><div><span>自动检查更新</span><i class="nexa-update-switch" aria-hidden="true"></i></div><div><button tabindex="-1">检查更新</button><small>当前已是最新版本</small></div></div></article>
</div>
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
