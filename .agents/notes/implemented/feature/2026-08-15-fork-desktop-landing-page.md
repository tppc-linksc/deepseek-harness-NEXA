# Agent Note: Publish the fork desktop landing page

Status: implemented

English | [中文](2026-08-15-fork-desktop-landing-page.zh.md)

## Problem

This fork distributes desktop installers but its GitHub Pages root redirects directly to the upstream Web UI quick start. A visitor cannot discover the macOS, Windows, and Linux builds, distinguish the official Harness runtime from the fork-owned Electron carrier, or reach the fork source without first navigating technical documentation. The fork has no separate product website, so removing the root landing page also removes the only stable product and download entry point.

## Decision

The locale roots publish a bilingual product landing page from `docs/user/index.md` and `docs/user/index.zh.md`. The page presents DeepSeek Harness as the official upstream product and labels the Electron desktop app as an unofficial community wrapper in the hero-adjacent disclosure. It links the official `deepseek-ai/deepseek-harness` repository separately from the `tppc-linksc/deepseek-harness-NEXA` desktop fork.

The landing page owns direct download links for the pinned desktop release tag and lists each supported artifact explicitly: macOS ARM64 DMG, Windows x64 NSIS EXE, and Linux x64 AppImage. It also links the release notes and checksum manifest and states the unsigned or ad-hoc signing limitation beside the downloads. A new desktop release updates this one canonical bilingual pair.

The documentation projector keeps the complete locale-home body instead of retaining only frontmatter. It still removes the repository-only language switcher, and the VitePress navigation continues to own locale selection. The locale roots use a custom product composition inside the default VitePress home layout instead of the default hero, feature cards, or a second application framework. The opening viewport combines the product statement, direct platform downloads, and a code-native illustration of the official interface so provenance and the primary action are visible together. A connected workflow sequence and an explicit official-runtime/desktop-shell layer view explain the desktop experience without introducing unsupported product claims. The presentation uses responsive semantic HTML and local CSS with keyboard focus treatment, reduced-motion behavior, and no remote media dependency. Canonical prose remains under `docs/user/`, while `website/` contains only configuration and presentation assets.

GitHub Actions builds the site with the Pages-provided `DOCS_BASE`, so project hosting at `/deepseek-harness-NEXA/` preserves navigation and asset URLs. Pages deployment remains separate from site construction and requires the fork repository setting to select GitHub Actions as the Pages source.

## Alternatives considered

**Keep the locale roots as quick-start redirects.** The [archived redirect decision](../../archived/simplification/2026-08-11-quickstart-documentation-home.md) avoids a second narrative when another product site exists. This fork has no other site, so the redirect makes its desktop distribution and release artifacts undiscoverable from the Pages root.

**Create a separate landing-page deployment.** A second site would isolate marketing presentation from documentation, but it would duplicate hosting configuration, navigation, localization, and branding while this VitePress project already publishes stable locale roots.

**Link only to GitHub Releases.** Releases remain the artifact authority, but they do not explain which runtime is official, what the fork adds, or how Web and desktop entry points relate.

**Generate download cards from the GitHub API in the browser.** Dynamic lookup would keep version labels current, but it adds runtime network failure and rate-limit behavior to a static site. Pinned artifact URLs make each published page deterministic and keep release updates reviewable.

## Consequences

The Pages root is a product and download surface rather than a shortcut to the first tutorial. Visitors can reach all supported installers, both source repositories, and the official documentation tree without ambiguity about authorship. The product statement has one site-owned bilingual source, and projector tests prevent the home body from being dropped during upstream synchronization.

The site takes on a deliberate release-maintenance obligation: every desktop release updates the version label and artifact URLs in both locale sources. The visual layer is additional maintained CSS and responsive semantic markup, while the documentation theme, search, sidebars, routes, and generated content stay on the existing VitePress system.
