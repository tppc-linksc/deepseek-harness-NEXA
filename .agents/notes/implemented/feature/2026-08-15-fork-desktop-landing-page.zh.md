# Agent Note: 发布 fork 桌面版产品首页

Status: implemented

[English](2026-08-15-fork-desktop-landing-page.md) | 中文

## 问题

本 fork 提供桌面安装包，但 GitHub Pages 根路由会直接跳转到上游 Web UI 快速开始。访问者无法在首页发现 macOS、Windows 与 Linux 版本，无法区分官方 Harness 运行时和本 fork 维护的 Electron 载体，也无法在进入技术文档前找到 fork 源码。本 fork 没有独立产品网站，因此删除根路由产品首页也会删除唯一稳定的产品与下载入口。

## 决策

两个 locale 根路由分别从 `docs/user/index.md` 与 `docs/user/index.zh.md` 发布双语产品首页。页面把 DeepSeek Harness 表述为官方上游产品，并在紧邻 hero 的醒目说明中把 Electron 桌面 App 标记为非官方社区封装。页面分别链接官方 `deepseek-ai/deepseek-harness` 仓库和 `tppc-linksc/deepseek-harness-NEXA` 桌面 fork。

产品首页维护指向固定桌面发行 tag 的直接下载链接，并显式列出每种受支持安装包：macOS ARM64 DMG、Windows x64 NSIS EXE 和 Linux x64 AppImage。下载区同时链接发布说明与校验文件，并就地说明未签名或 ad-hoc 签名限制。发布新桌面版本时只需更新这一对权威双语来源。

文档投影器会保留 locale 首页的完整正文，不再只保留 frontmatter。它仍会移除只供仓库阅读使用的语言切换行，locale 切换仍由 VitePress 导航维护。两个 locale 根路由在 VitePress 默认首页布局中使用自定义编辑式编排，不使用默认 hero、功能卡片或第二套应用框架。深色氛围首屏、克制的字号层级、桌面窗口示意、线性下载列表与运行时轴线共同呈现产品层级，避免把每项事实都放进卡片。视觉氛围与窗口示意只使用 CSS 和语义化 HTML，因此首页没有远程媒体依赖；系统启用 `prefers-reduced-motion` 时会停止动效。权威文案仍存放在 `docs/user/`，`website/` 只包含配置与展示资源。

GitHub Actions 使用 Pages 提供的 `DOCS_BASE` 构建网站，因此托管在 `/deepseek-harness-NEXA/` 项目路径时，导航与资源 URL 仍然有效。Pages 部署仍与网站构建分离，并要求 fork 仓库把 GitHub Actions 设为 Pages 发布源。

## 考虑过的替代方案

**继续把 locale 根路由重定向到快速开始。** 当产品另有独立官网时，[已归档的重定向决策](../../archived/simplification/2026-08-11-quickstart-documentation-home.md)可以避免第二套产品叙事。本 fork 没有其他网站，因此重定向会让 Pages 根路由无法展示桌面发行版及其安装包。

**单独部署产品首页。** 第二个网站可以把产品展示与技术文档分开，但会重复托管配置、导航、本地化和品牌资源，而现有 VitePress 项目已经发布稳定的 locale 根路由。

**只链接 GitHub Releases。** Releases 仍是安装包的权威来源，但它无法解释哪部分是官方运行时、本 fork 新增了什么，以及 Web 与桌面入口之间的关系。

**在浏览器中通过 GitHub API 动态生成下载卡片。** 动态查询可以自动显示最新版本，但会给静态网站增加网络故障和 API 限流行为。固定安装包 URL 能让每次发布保持确定，并使版本更新进入正常评审。

## 结果

Pages 根路由成为产品与下载入口，不再只是首篇教程的快捷跳转。访问者可以找到全部受支持安装包、两个源码仓库和官方文档树，并能明确区分各自归属。产品说明由一对网站权威双语来源维护，投影器测试会阻止首页正文在上游同步时被再次删除。

网站由此承担明确的发行维护责任：每次桌面发行都要更新两个 locale 来源中的版本标签和安装包 URL。仓库需要维护额外的视觉 CSS 与响应式语义标记，但文档主题、搜索、侧边栏、路由和生成内容仍沿用现有 VitePress 系统。
