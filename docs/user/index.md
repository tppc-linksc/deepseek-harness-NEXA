---
layout: home
title: DeepSeek Harness Desktop
titleTemplate: false
description: The official DeepSeek Harness Web UI and agent runtime, packaged as an unofficial desktop app for macOS, Windows, and Linux.
---

# DeepSeek Harness

English | [中文](index.zh.md)

<main class="nexa-site">
<header class="nexa-intro" aria-labelledby="nexa-intro-title">
<div class="nexa-intro-meta"><span>DeepSeek Harness</span><span>Community desktop wrapper</span></div>
<div class="nexa-intro-grid">
<div class="nexa-intro-copy">
<p class="nexa-label">macOS · Windows · Linux</p>
<h2 id="nexa-intro-title">DeepSeek Harness,<br>on your desktop.</h2>
<p class="nexa-intro-lead">The official Web UI, plugin system, and agent runtime remain intact. This fork adds an Electron shell and native installers, so the Harness starts as an ordinary app.</p>
<div class="nexa-actions"><a class="nexa-primary-action" href="#download">Download desktop app</a><a class="nexa-text-action" href="https://github.com/tppc-linksc/deepseek-harness-NEXA">View source <span aria-hidden="true">↗</span></a></div>
</div>
<aside class="nexa-release-panel" aria-label="Current desktop release">
<div class="nexa-release-head"><span>Current release</span><strong>0.1.0-rc.5</strong></div>
<dl><div><dt>macOS</dt><dd>Apple Silicon · DMG</dd></div><div><dt>Windows</dt><dd>x64 · NSIS EXE</dd></div><div><dt>Linux</dt><dd>x86_64 · AppImage</dd></div></dl>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">View release details <span aria-hidden="true">→</span></a>
</aside>
</div>
<div class="nexa-disclosure"><strong>This is an unofficial desktop wrapper.</strong><p>DeepSeek AI maintains the official Harness. This community fork maintains only the Electron shell, native installers, and this download page.</p><a href="https://github.com/deepseek-ai/deepseek-harness">Official repository <span aria-hidden="true">↗</span></a></div>
</header>

<section class="nexa-product" aria-labelledby="nexa-product-title">
<div class="nexa-product-heading"><p class="nexa-label">What this fork adds</p><h2 id="nexa-product-title">No Harness rewrite.<br>Just an app.</h2></div>
<div class="nexa-product-body">
<p class="nexa-product-summary">The desktop edition runs the official frontend and the same Host composition. Projects, plugins, tools, and session capabilities are not duplicated.</p>
<ol class="nexa-facts"><li><span>01</span><div><strong>The same interface</strong><p>The desktop window loads the official DeepSeek Harness Web UI instead of maintaining a parallel frontend.</p></div></li><li><span>02</span><div><strong>No listening port</strong><p>The Electron renderer and Host child process communicate over private IPC without starting a local HTTP service.</p></div></li><li><span>03</span><div><strong>Separate writable state</strong><p>Desktop sessions, settings, credentials, and logs use their own directory and can run beside the Web edition.</p></div></li></ol>
</div>
</section>

<section id="download" class="nexa-downloads" aria-labelledby="nexa-download-title">
<div class="nexa-download-heading"><p class="nexa-label">Download</p><h2 id="nexa-download-title">Choose an installer</h2><p>Installers are served by GitHub Releases. The macOS and Windows builds are not commercially code-signed, so the operating system may show a security prompt on first launch.</p></div>
<div class="nexa-download-list">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg"><span class="nexa-platform">macOS</span><span>Apple Silicon</span><span>DMG · ad-hoc signed</span><b aria-hidden="true">Download ↓</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe"><span class="nexa-platform">Windows</span><span>Windows 10+ · x64</span><span>NSIS EXE · unsigned</span><b aria-hidden="true">Download ↓</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage"><span class="nexa-platform">Linux</span><span>Linux · x86_64</span><span>Portable AppImage</span><b aria-hidden="true">Download ↓</b></a>
</div>
<div class="nexa-download-meta"><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">Release notes</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/SHA256SUMS.txt">SHA-256 checksums</a></div>
</section>

<section class="nexa-runtime" aria-labelledby="nexa-runtime-title">
<div class="nexa-runtime-heading"><p class="nexa-label">How it runs</p><h2 id="nexa-runtime-title">The desktop app is not another Web service.</h2><p>The app starts and stops both the window and Host. It needs no extra terminal and does not take the Web edition's port or writable directories.</p></div>
<div class="nexa-process"><div><small>Electron renderer</small><strong>Official Web UI</strong></div><span>Private process IPC</span><div><small>UtilityProcess</small><strong>Harness Host</strong></div></div>
<p class="nexa-runtime-note">Prefer to run from source? Clone the repository, then run <code>pnpm install</code> and <code>pnpm run start:desktop</code>.</p>
</section>

<footer class="nexa-footer"><div><strong>DeepSeek Harness / NEXA</strong><p>An unofficial desktop wrapper for the official open-source Harness.</p></div><nav><a href="https://github.com/deepseek-ai/deepseek-harness">Official upstream</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">Desktop fork</a><a href="./guide/quickstart">Documentation</a></nav></footer>
</main>
