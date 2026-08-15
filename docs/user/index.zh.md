---
layout: home
title: DeepSeek Harness 桌面版
titleTemplate: false
description: 完整保留 DeepSeek 官方 Harness Web UI 与 agent 运行时，并提供适用于 macOS、Windows 和 Linux 的非官方桌面 App。
---

# DeepSeek Harness

[English](index.md) | 中文

<main class="nexa-site">
<header class="nexa-intro" aria-labelledby="nexa-intro-title">
<div class="nexa-intro-meta"><span>DeepSeek Harness</span><span>社区桌面封装</span></div>
<div class="nexa-intro-grid">
<div class="nexa-intro-copy">
<p class="nexa-label">macOS · Windows · Linux</p>
<h2 id="nexa-intro-title">把 DeepSeek Harness<br>放进桌面。</h2>
<p class="nexa-intro-lead">官方 Web UI、插件系统与 agent 运行时保持不变。本 fork 增加 Electron 外壳和原生安装包，打开 App 就能开始工作。</p>
<div class="nexa-actions"><a class="nexa-primary-action" href="#download">下载桌面版</a><a class="nexa-text-action" href="https://github.com/tppc-linksc/deepseek-harness-NEXA">查看源码 <span aria-hidden="true">↗</span></a></div>
</div>
<aside class="nexa-release-panel" aria-label="当前桌面版本">
<div class="nexa-release-head"><span>当前版本</span><strong>0.1.0-rc.5</strong></div>
<dl><div><dt>macOS</dt><dd>Apple Silicon · DMG</dd></div><div><dt>Windows</dt><dd>x64 · NSIS EXE</dd></div><div><dt>Linux</dt><dd>x86_64 · AppImage</dd></div></dl>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">查看发布信息 <span aria-hidden="true">→</span></a>
</aside>
</div>
<div class="nexa-disclosure"><strong>这是非官方桌面封装。</strong><p>DeepSeek AI 维护官方 Harness；本社区 fork 只维护 Electron 外壳、三端安装包与这个下载页面。</p><a href="https://github.com/deepseek-ai/deepseek-harness">官方仓库 <span aria-hidden="true">↗</span></a></div>
</header>

<section class="nexa-product" aria-labelledby="nexa-product-title">
<div class="nexa-product-heading"><p class="nexa-label">本 fork 增加的内容</p><h2 id="nexa-product-title">不重写 Harness。<br>只把它变成 App。</h2></div>
<div class="nexa-product-body">
<p class="nexa-product-summary">桌面版直接运行官方前端和同一套 Host 组合。项目、插件、工具和会话能力没有另做一份。</p>
<ol class="nexa-facts"><li><span>01</span><div><strong>同一套界面</strong><p>桌面窗口加载官方 DeepSeek Harness Web UI，不维护平行前端。</p></div></li><li><span>02</span><div><strong>不开放端口</strong><p>Electron renderer 与 Host 子进程通过私有 IPC 通信，不启动本地 HTTP 服务。</p></div></li><li><span>03</span><div><strong>状态相互隔离</strong><p>桌面会话、设置、凭据与日志使用自己的目录，可与 Web 版本同时运行。</p></div></li></ol>
</div>
</section>

<section id="download" class="nexa-downloads" aria-labelledby="nexa-download-title">
<div class="nexa-download-heading"><p class="nexa-label">下载</p><h2 id="nexa-download-title">选择安装包</h2><p>安装包来自 GitHub Releases。macOS 与 Windows 版本没有商业代码签名，系统可能在首次启动时显示安全提示。</p></div>
<div class="nexa-download-list">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg"><span class="nexa-platform">macOS</span><span>Apple Silicon</span><span>DMG · ad-hoc 签名</span><b aria-hidden="true">下载 ↓</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe"><span class="nexa-platform">Windows</span><span>Windows 10+ · x64</span><span>NSIS EXE · 未签名</span><b aria-hidden="true">下载 ↓</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage"><span class="nexa-platform">Linux</span><span>Linux · x86_64</span><span>免安装 AppImage</span><b aria-hidden="true">下载 ↓</b></a>
</div>
<div class="nexa-download-meta"><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">发布说明</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/SHA256SUMS.txt">SHA-256 校验文件</a></div>
</section>

<section class="nexa-runtime" aria-labelledby="nexa-runtime-title">
<div class="nexa-runtime-heading"><p class="nexa-label">运行方式</p><h2 id="nexa-runtime-title">桌面端不是另一个 Web 服务。</h2><p>窗口和 Host 都由 App 自己启动和回收，不需要额外打开终端，也不会占用 Web 版本的端口或工作目录。</p></div>
<div class="nexa-process"><div><small>Electron renderer</small><strong>官方 Web UI</strong></div><span>私有进程 IPC</span><div><small>UtilityProcess</small><strong>Harness Host</strong></div></div>
<p class="nexa-runtime-note">希望从源码运行？克隆仓库并执行 <code>pnpm install</code> 与 <code>pnpm run start:desktop</code>。</p>
</section>

<footer class="nexa-footer"><div><strong>DeepSeek Harness / NEXA</strong><p>官方开源 Harness 的非官方桌面封装。</p></div><nav><a href="https://github.com/deepseek-ai/deepseek-harness">官方上游</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">桌面 fork</a><a href="./guide/quickstart">使用文档</a></nav></footer>
</main>
