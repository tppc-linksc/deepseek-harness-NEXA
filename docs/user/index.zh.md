---
layout: home
title: DeepSeek Harness 桌面版
titleTemplate: false
description: 完整保留 DeepSeek 官方 Harness Web UI 与 agent 运行时，并提供适用于 macOS、Windows 和 Linux 的非官方桌面 App。
---

# DeepSeek Harness

[English](index.md) | 中文

<main class="nexa-home">
<section class="nexa-hero" aria-labelledby="nexa-hero-title">
<div class="nexa-atmosphere" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
<div class="nexa-hero-grid">
<div class="nexa-hero-copy">
<p class="nexa-overline">DEEPSEEK HARNESS · 社区桌面版</p>
<h2 id="nexa-hero-title">一切皆插件</h2>
<p class="nexa-hero-lead">DeepSeek 官方开源 agent harness，完整保留 Web UI 与运行时。本 fork 只增加桌面入口，让它像普通 App 一样启动。</p>
<div class="nexa-hero-actions">
<a class="nexa-button nexa-button-primary" href="#download">下载桌面 App <span aria-hidden="true">↘</span></a>
<a class="nexa-button nexa-button-quiet" href="https://github.com/tppc-linksc/deepseek-harness-NEXA">查看 GitHub <span aria-hidden="true">→</span></a>
</div>
<p class="nexa-hero-note"><span aria-hidden="true"></span>非官方社区封装 · macOS / Windows / Linux</p>
</div>
<div class="nexa-app-stage" aria-label="DeepSeek Harness 桌面应用窗口示意">
<div class="nexa-app-shadow" aria-hidden="true"></div>
<div class="nexa-app-window">
<div class="nexa-app-titlebar"><span class="nexa-window-lights" aria-hidden="true"><i></i><i></i><i></i></span><strong>DeepSeek Harness</strong><span>RC5</span></div>
<div class="nexa-app-body">
<aside class="nexa-app-sidebar" aria-hidden="true"><b>DEEPSEEK <em>HARNESS</em></b><i></i><i></i><i></i><span></span></aside>
<div class="nexa-app-canvas">
<div class="nexa-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
<p>探索未至之境</p>
<span>选择工作区开始</span>
<div class="nexa-prompt-line" aria-hidden="true"><i></i><i></i></div>
</div>
</div>
</div>
</div>
</div>
<div class="nexa-scroll-cue" aria-hidden="true"><span></span>SCROLL TO EXPLORE</div>
</section>
<section class="nexa-statement" aria-labelledby="statement-title">
<p class="nexa-index">AGENT · MODEL · HARNESS</p>
<h2 id="statement-title"><span>HARNESS</span> 让 agent 在真实项目里持续工作</h2>
<p>模型负责推理，Harness 连接工具、工作区、会话与执行环境。它不是聊天页面，而是 agent 的工作系统。</p>
</section>
<section class="nexa-edition" aria-labelledby="edition-title">
<div class="nexa-section-number">01 / DESKTOP EDITION</div>
<div class="nexa-edition-heading">
<h2 id="edition-title">官方核心，<br>换一种入口。</h2>
<p>桌面版没有重新实现 DeepSeek Harness。Electron 启动同一套 Host 与 Web UI，并通过私有进程 IPC 通信，不暴露 HTTP 监听端口。</p>
</div>
<div class="nexa-edition-facts">
<div><span>PROCESS</span><strong>子进程承载 Harness Host</strong></div>
<div><span>STATE</span><strong>桌面数据与 Web profile 分离</strong></div>
<div><span>RUNTIME</span><strong>插件、工具、会话能力完整保留</strong></div>
</div>
<div class="nexa-disclosure-line">
<span>COMMUNITY WRAPPER</span>
<p>桌面 App 由本社区 fork 封装，并非 DeepSeek 官方发布。DeepSeek AI 维护上游 Harness；本 fork 维护桌面外壳与安装包。</p>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/tree/master/apps/desktop">查看实现 →</a>
</div>
</section>
<section id="download" class="nexa-downloads" aria-labelledby="download-title">
<div class="nexa-section-number">02 / DOWNLOAD</div>
<div class="nexa-download-heading">
<div><p>DESKTOP RC5 · 0.1.0-rc.5</p><h2 id="download-title">选择你的平台</h2></div>
<p>三个版本包含同一套 Harness 运行时。请选择与你的操作系统及 CPU 架构匹配的安装包。</p>
</div>
<div class="nexa-download-list">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg"><span class="nexa-download-no">01</span><strong>macOS</strong><span>Apple Silicon · ARM64</span><span>DMG · ad-hoc 签名</span><b aria-hidden="true">↘</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe"><span class="nexa-download-no">02</span><strong>Windows</strong><span>Windows 10+ · x64</span><span>NSIS EXE · 未签名</span><b aria-hidden="true">↘</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage"><span class="nexa-download-no">03</span><strong>Linux</strong><span>Linux · x86_64</span><span>免安装 AppImage</span><b aria-hidden="true">↘</b></a>
</div>
<div class="nexa-release-meta"><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">发布说明 ↗</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/SHA256SUMS.txt">SHA-256 校验 ↗</a><span>macOS 与 Windows 安装包没有商业代码签名。</span></div>
</section>
<section class="nexa-runtime" aria-labelledby="runtime-title">
<div class="nexa-section-number">03 / ONE RUNTIME</div>
<div class="nexa-runtime-heading"><h2 id="runtime-title">同一个 Harness，<br>两种使用方式。</h2><p>Web 和桌面入口可以同时运行。它们共享官方能力，但各自拥有独立的可写状态。</p></div>
<div class="nexa-runtime-axis" role="img" aria-label="官方 Harness 运行时连接 Web UI 与社区桌面 App">
<div class="nexa-runtime-source"><span>DEEPSEEK HARNESS</span><strong>插件化运行时</strong><small>Agent loop · Tools · Workspaces · Sessions · Providers</small></div>
<div class="nexa-runtime-destinations"><div><span>OFFICIAL</span><strong>Web UI</strong><small>Browser · localhost HTTP</small></div><div><span>COMMUNITY</span><strong>Desktop App</strong><small>Electron · private process IPC</small></div></div>
</div>
</section>
<footer class="nexa-footer">
<p>DeepSeek Harness / NEXA</p>
<div><a href="https://github.com/deepseek-ai/deepseek-harness">官方上游 ↗</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">桌面 fork ↗</a><a href="./guide/quickstart">使用文档 →</a></div>
<small>DeepSeek Harness 是 DeepSeek AI 的开源项目。本网站与桌面安装包由社区 fork 维护。</small>
</footer>
</main>
