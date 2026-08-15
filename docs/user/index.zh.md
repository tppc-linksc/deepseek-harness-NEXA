---
layout: home
title: DeepSeek Harness 桌面版
titleTemplate: false
description: 完整保留 DeepSeek 官方 Harness Web UI 与 agent 运行时，并提供适用于 macOS、Windows 和 Linux 的非官方桌面 App。
hero:
  name: DeepSeek Harness
  text: 一切皆插件。现在，直接在桌面打开。
  tagline: DeepSeek 官方开源 Agent Harness，完整保留 Web UI 与运行时；本社区 fork 额外提供无端口 Electron 桌面外壳和原生安装包。
  image:
    src: /favicon.svg
    alt: DeepSeek 鲸鱼标志
  actions:
    - theme: brand
      text: 下载桌面 App
      link: '#download'
    - theme: alt
      text: 在 GitHub 查看源码
      link: https://github.com/tppc-linksc/deepseek-harness-NEXA
features:
  - title: 完整保留官方 Harness
    details: DeepSeek Web UI、插件图、agent 运行时、工作区、会话和模型提供方配置仍是产品核心。
  - title: 真正的桌面进程
    details: Electron 在子 UtilityProcess 中启动 Harness Host，通过私有进程 IPC 通信，不暴露 HTTP 监听端口。
  - title: 桌面专属本地状态
    details: 会话、设置、凭据、插件、Chromium 数据和日志与同时运行的 Web profile 相互隔离。
---

# DeepSeek Harness

[English](index.md) | 中文

<div class="nexa-home">
<section class="nexa-disclosure" aria-labelledby="desktop-disclosure-title">
<div class="nexa-disclosure-mark" aria-hidden="true">APP</div>
<div class="nexa-disclosure-copy">
<span class="nexa-kicker">本 FORK 的新增内容</span>
<h2 id="desktop-disclosure-title">桌面 App 是社区封装，不是 DeepSeek 官方发布。</h2>
<p>它直接复用官方 Harness Web UI 与运行时，没有重新实现产品。DeepSeek AI 发布上游项目；本 fork 负责将该项目封装为原生桌面安装包。</p>
</div>
<a class="nexa-text-link" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/tree/master/apps/desktop">查看桌面端实现 <span aria-hidden="true">→</span></a>
</section>
<section id="download" class="nexa-section nexa-downloads" aria-labelledby="download-title">
<div class="nexa-section-heading">
<div>
<span class="nexa-kicker">桌面 RC5 · 0.1.0-rc.5</span>
<h2 id="download-title">选择你的平台</h2>
</div>
<p>三个版本包含相同的 Harness 运行时，请选择与你的操作系统和 CPU 架构匹配的安装包。</p>
</div>
<div class="nexa-download-grid">
<a class="nexa-download-card" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg">
<span class="nexa-platform-mark" aria-hidden="true">mac</span>
<span class="nexa-platform-meta">APPLE SILICON · ARM64</span>
<strong>macOS</strong>
<span class="nexa-platform-format">DMG · ad-hoc 签名</span>
<span class="nexa-download-action">下载 .dmg <span aria-hidden="true">↓</span></span>
</a>
<a class="nexa-download-card" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe">
<span class="nexa-platform-mark" aria-hidden="true">win</span>
<span class="nexa-platform-meta">WINDOWS 10+ · X64</span>
<strong>Windows</strong>
<span class="nexa-platform-format">NSIS EXE · 未签名</span>
<span class="nexa-download-action">下载 .exe <span aria-hidden="true">↓</span></span>
</a>
<a class="nexa-download-card" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage">
<span class="nexa-platform-mark" aria-hidden="true">linux</span>
<span class="nexa-platform-meta">LINUX · X86_64</span>
<strong>Linux</strong>
<span class="nexa-platform-format">免安装 AppImage</span>
<span class="nexa-download-action">下载 AppImage <span aria-hidden="true">↓</span></span>
</a>
</div>
<div class="nexa-release-links">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">发布说明</a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/SHA256SUMS.txt">SHA-256 校验文件</a>
<span>macOS 与 Windows 安装包均没有商业代码签名。</span>
</div>
</section>
<section class="nexa-section nexa-runtime" aria-labelledby="runtime-title">
<div class="nexa-section-heading nexa-section-heading-centered">
<div>
<span class="nexa-kicker">同一个 HARNESS · 两种入口</span>
<h2 id="runtime-title">官方核心保持不变</h2>
</div>
<p>桌面版只改变承载方式，不改变产品运行时。Web 与桌面入口可以同时运行，而且不会共用可写状态。</p>
</div>
<div class="nexa-runtime-map" role="img" aria-label="官方 Harness 核心同时为 Web UI 和桌面 App 提供能力">
<div class="nexa-runtime-core">
<span>DEEPSEEK HARNESS</span>
<strong>插件化运行时</strong>
<small>Agent loop · Tools · Workspaces · Sessions · Providers</small>
</div>
<div class="nexa-runtime-branch">
<div class="nexa-runtime-node">
<span>官方入口</span>
<strong>Web UI</strong>
<small>浏览器 · localhost HTTP</small>
</div>
<div class="nexa-runtime-node nexa-runtime-node-accent">
<span>本 FORK 新增</span>
<strong>桌面 App</strong>
<small>Electron · 私有进程 IPC</small>
</div>
</div>
</div>
</section>
<section class="nexa-section nexa-links" aria-labelledby="links-title">
<div>
<span class="nexa-kicker">源码与文档</span>
<h2 id="links-title">从代码开始</h2>
<p>上游开发请访问官方仓库；桌面封装、安装包及此发行版特有的问题请访问 NEXA fork。</p>
</div>
<div class="nexa-repository-grid">
<a href="https://github.com/deepseek-ai/deepseek-harness">
<span>官方上游</span>
<strong>deepseek-ai/deepseek-harness</strong>
<small>官方 Harness 源码</small>
</a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">
<span>桌面 FORK</span>
<strong>tppc-linksc/deepseek-harness-NEXA</strong>
<small>桌面源码与安装包</small>
</a>
<a href="https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/user/guide">
<span>使用文档</span>
<strong>官方用户指南</strong>
<small>Web UI 快速开始与配置来源</small>
</a>
</div>
</section>
</div>
