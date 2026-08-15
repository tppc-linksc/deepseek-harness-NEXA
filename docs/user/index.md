---
layout: home
title: DeepSeek Harness Desktop
titleTemplate: false
description: The official DeepSeek Harness Web UI and agent runtime, packaged as an unofficial desktop app for macOS, Windows, and Linux.
---

# DeepSeek Harness

English | [中文](index.zh.md)

<main class="nexa-home">
<section class="nexa-hero" aria-labelledby="nexa-hero-title">
<div class="nexa-atmosphere" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
<div class="nexa-hero-grid">
<div class="nexa-hero-copy">
<p class="nexa-overline">DEEPSEEK HARNESS · COMMUNITY DESKTOP</p>
<h2 id="nexa-hero-title">Everything is a plugin</h2>
<p class="nexa-hero-lead">DeepSeek's official open-source agent harness, with its Web UI and runtime intact. This fork adds only a desktop entry point, so it starts like any other app.</p>
<div class="nexa-hero-actions">
<a class="nexa-button nexa-button-primary" href="#download">Download desktop app <span aria-hidden="true">↘</span></a>
<a class="nexa-button nexa-button-quiet" href="https://github.com/tppc-linksc/deepseek-harness-NEXA">View on GitHub <span aria-hidden="true">→</span></a>
</div>
<p class="nexa-hero-note"><span aria-hidden="true"></span>Unofficial community wrapper · macOS / Windows / Linux</p>
</div>
<div class="nexa-app-stage" aria-label="Illustration of the DeepSeek Harness desktop application window">
<div class="nexa-app-shadow" aria-hidden="true"></div>
<div class="nexa-app-window">
<div class="nexa-app-titlebar"><span class="nexa-window-lights" aria-hidden="true"><i></i><i></i><i></i></span><strong>DeepSeek Harness</strong><span>RC5</span></div>
<div class="nexa-app-body">
<aside class="nexa-app-sidebar" aria-hidden="true"><b>DEEPSEEK <em>HARNESS</em></b><i></i><i></i><i></i><span></span></aside>
<div class="nexa-app-canvas">
<div class="nexa-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
<p>Explore the uncharted</p>
<span>Choose a workspace to begin</span>
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
<h2 id="statement-title"><span>HARNESS</span> keeps agents working in real projects</h2>
<p>The model reasons. Harness connects tools, workspaces, sessions, and execution environments. It is not a chat page; it is the agent's working system.</p>
</section>
<section class="nexa-edition" aria-labelledby="edition-title">
<div class="nexa-section-number">01 / DESKTOP EDITION</div>
<div class="nexa-edition-heading">
<h2 id="edition-title">The official core.<br>A different entry point.</h2>
<p>The desktop edition does not reimplement DeepSeek Harness. Electron starts the same Host and Web UI, communicating over private process IPC without exposing an HTTP listening port.</p>
</div>
<div class="nexa-edition-facts">
<div><span>PROCESS</span><strong>A child process carries Harness Host</strong></div>
<div><span>STATE</span><strong>Desktop data stays separate from the Web profile</strong></div>
<div><span>RUNTIME</span><strong>Plugins, tools, and sessions remain intact</strong></div>
</div>
<div class="nexa-disclosure-line">
<span>COMMUNITY WRAPPER</span>
<p>The desktop app is packaged by this community fork; it is not an official DeepSeek release. DeepSeek AI maintains the upstream Harness, while this fork maintains the desktop shell and installers.</p>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/tree/master/apps/desktop">Inspect the implementation →</a>
</div>
</section>
<section id="download" class="nexa-downloads" aria-labelledby="download-title">
<div class="nexa-section-number">02 / DOWNLOAD</div>
<div class="nexa-download-heading">
<div><p>DESKTOP RC5 · 0.1.0-rc.5</p><h2 id="download-title">Choose your platform</h2></div>
<p>Every build contains the same Harness runtime. Select the installer matching your operating system and CPU architecture.</p>
</div>
<div class="nexa-download-list">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg"><span class="nexa-download-no">01</span><strong>macOS</strong><span>Apple Silicon · ARM64</span><span>DMG · ad-hoc signed</span><b aria-hidden="true">↘</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe"><span class="nexa-download-no">02</span><strong>Windows</strong><span>Windows 10+ · x64</span><span>NSIS EXE · unsigned</span><b aria-hidden="true">↘</b></a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage"><span class="nexa-download-no">03</span><strong>Linux</strong><span>Linux · x86_64</span><span>Portable AppImage</span><b aria-hidden="true">↘</b></a>
</div>
<div class="nexa-release-meta"><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">Release notes ↗</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/SHA256SUMS.txt">SHA-256 checksums ↗</a><span>The macOS and Windows installers are not commercially code-signed.</span></div>
</section>
<section class="nexa-runtime" aria-labelledby="runtime-title">
<div class="nexa-section-number">03 / ONE RUNTIME</div>
<div class="nexa-runtime-heading"><h2 id="runtime-title">One Harness.<br>Two ways in.</h2><p>Web and desktop entry points can run side by side. They share the official capabilities while keeping writable state separate.</p></div>
<div class="nexa-runtime-axis" role="img" aria-label="The official Harness runtime connects to the Web UI and community desktop app">
<div class="nexa-runtime-source"><span>DEEPSEEK HARNESS</span><strong>Plugin runtime</strong><small>Agent loop · Tools · Workspaces · Sessions · Providers</small></div>
<div class="nexa-runtime-destinations"><div><span>OFFICIAL</span><strong>Web UI</strong><small>Browser · localhost HTTP</small></div><div><span>COMMUNITY</span><strong>Desktop App</strong><small>Electron · private process IPC</small></div></div>
</div>
</section>
<footer class="nexa-footer">
<p>DeepSeek Harness / NEXA</p>
<div><a href="https://github.com/deepseek-ai/deepseek-harness">Official upstream ↗</a><a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">Desktop fork ↗</a><a href="./guide/quickstart">Documentation →</a></div>
<small>DeepSeek Harness is an open-source project by DeepSeek AI. This website and the desktop installers are maintained by the community fork.</small>
</footer>
</main>
