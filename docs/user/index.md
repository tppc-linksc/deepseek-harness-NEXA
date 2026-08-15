---
layout: home
title: DeepSeek Harness Desktop
titleTemplate: false
description: The official DeepSeek Harness Web UI and agent runtime, packaged as an unofficial desktop app for macOS, Windows, and Linux.
hero:
  name: DeepSeek Harness
  text: Everything is a plugin. Now it opens like a desktop app.
  tagline: The official open-source agent harness from DeepSeek, with its Web UI and runtime intact. This community fork adds a portless Electron desktop shell and native installers.
  image:
    src: /favicon.svg
    alt: DeepSeek whale mark
  actions:
    - theme: brand
      text: Download desktop app
      link: '#download'
    - theme: alt
      text: View source on GitHub
      link: https://github.com/tppc-linksc/deepseek-harness-NEXA
features:
  - title: Official Harness intact
    details: The DeepSeek Web UI, plugin graph, agent runtime, workspaces, sessions, and provider configuration remain the product core.
  - title: A real desktop process
    details: Electron starts Harness Host in a child UtilityProcess and uses private process IPC instead of exposing an HTTP listening port.
  - title: Desktop-owned local state
    details: Sessions, settings, credentials, plugins, Chromium data, and logs stay separate from a concurrently running Web profile.
---

# DeepSeek Harness

English | [中文](index.zh.md)

<div class="nexa-home">
<section class="nexa-disclosure" aria-labelledby="desktop-disclosure-title">
<div class="nexa-disclosure-mark" aria-hidden="true">APP</div>
<div class="nexa-disclosure-copy">
<span class="nexa-kicker">WHAT THIS FORK ADDS</span>
<h2 id="desktop-disclosure-title">The desktop app is a community wrapper, not an official DeepSeek release.</h2>
<p>It reuses the official Harness Web UI and runtime rather than replacing them. DeepSeek AI publishes the upstream project; this fork packages that project into native desktop installers.</p>
</div>
<a class="nexa-text-link" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/tree/master/apps/desktop">Inspect the desktop implementation <span aria-hidden="true">→</span></a>
</section>
<section id="download" class="nexa-section nexa-downloads" aria-labelledby="download-title">
<div class="nexa-section-heading">
<div>
<span class="nexa-kicker">DESKTOP RC5 · 0.1.0-rc.5</span>
<h2 id="download-title">Choose your platform</h2>
</div>
<p>All builds contain the same Harness runtime. Select the installer matching your operating system and CPU architecture.</p>
</div>
<div class="nexa-download-grid">
<a class="nexa-download-card" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-mac-arm64.dmg">
<span class="nexa-platform-mark" aria-hidden="true">mac</span>
<span class="nexa-platform-meta">APPLE SILICON · ARM64</span>
<strong>macOS</strong>
<span class="nexa-platform-format">DMG · ad-hoc signed</span>
<span class="nexa-download-action">Download .dmg <span aria-hidden="true">↓</span></span>
</a>
<a class="nexa-download-card" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-win-x64.exe">
<span class="nexa-platform-mark" aria-hidden="true">win</span>
<span class="nexa-platform-meta">WINDOWS 10+ · X64</span>
<strong>Windows</strong>
<span class="nexa-platform-format">NSIS EXE · unsigned</span>
<span class="nexa-download-action">Download .exe <span aria-hidden="true">↓</span></span>
</a>
<a class="nexa-download-card" href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/DeepSeek-Harness-0.1.0-rc.5-linux-x64.AppImage">
<span class="nexa-platform-mark" aria-hidden="true">linux</span>
<span class="nexa-platform-meta">LINUX · X86_64</span>
<strong>Linux</strong>
<span class="nexa-platform-format">Portable AppImage</span>
<span class="nexa-download-action">Download AppImage <span aria-hidden="true">↓</span></span>
</a>
</div>
<div class="nexa-release-links">
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/tag/desktop-v0.1.0-rc.5">Release notes</a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA/releases/download/desktop-v0.1.0-rc.5/SHA256SUMS.txt">SHA-256 checksums</a>
<span>macOS and Windows builds are not commercially code-signed.</span>
</div>
</section>
<section class="nexa-section nexa-runtime" aria-labelledby="runtime-title">
<div class="nexa-section-heading nexa-section-heading-centered">
<div>
<span class="nexa-kicker">ONE HARNESS · TWO ENTRY POINTS</span>
<h2 id="runtime-title">The official core stays the same</h2>
</div>
<p>The desktop edition changes the carrier, not the product runtime. Web and desktop can run side by side without sharing writable state.</p>
</div>
<div class="nexa-runtime-map" role="img" aria-label="The official Harness core serves both Web UI and desktop app entry points">
<div class="nexa-runtime-core">
<span>DEEPSEEK HARNESS</span>
<strong>Plugin runtime</strong>
<small>Agent loop · Tools · Workspaces · Sessions · Providers</small>
</div>
<div class="nexa-runtime-branch">
<div class="nexa-runtime-node">
<span>OFFICIAL ENTRY</span>
<strong>Web UI</strong>
<small>Browser · localhost HTTP</small>
</div>
<div class="nexa-runtime-node nexa-runtime-node-accent">
<span>THIS FORK ADDS</span>
<strong>Desktop App</strong>
<small>Electron · private process IPC</small>
</div>
</div>
</div>
</section>
<section class="nexa-section nexa-links" aria-labelledby="links-title">
<div>
<span class="nexa-kicker">SOURCE & DOCUMENTATION</span>
<h2 id="links-title">Start with the code</h2>
<p>Use the official repository for upstream development and the NEXA fork for desktop packaging, installers, and issue tracking specific to this distribution.</p>
</div>
<div class="nexa-repository-grid">
<a href="https://github.com/deepseek-ai/deepseek-harness">
<span>UPSTREAM</span>
<strong>deepseek-ai/deepseek-harness</strong>
<small>Official Harness source</small>
</a>
<a href="https://github.com/tppc-linksc/deepseek-harness-NEXA">
<span>DESKTOP FORK</span>
<strong>tppc-linksc/deepseek-harness-NEXA</strong>
<small>Desktop source and releases</small>
</a>
<a href="https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/user/guide">
<span>DOCUMENTATION</span>
<strong>Official user guides</strong>
<small>Web UI quick start and configuration sources</small>
</a>
</div>
</section>
</div>
