# Agent Note: CI 对私有 NEXA Remote 依赖进行认证

Status: implemented

[English](2026-09-02-private-nexa-remote-ci-authentication.md) | 中文

## Problem

公开的 NEXA Harness 仓库依赖私有 `tppc-linksc/NEXA-Remote` 仓库中固定到具体提交的一个包。本地开发通过维护者的 SSH 身份解析该地址，而 GitHub 托管 runner 没有这份身份。因此，所有安装完整 workspace 的 workflow 都会在自身检查开始前失败；使用通用个人 token 又会让日常构建任务获得超出该依赖所需范围的仓库权限。

## Decision

`tppc-linksc/NEXA-Remote` 向 `tppc-linksc/deepseek-harness-NEXA` 授予一把只读 deploy key。Harness 仓库把私钥保存为 `NEXA_REMOTE_DEPLOY_KEY` Actions secret。每个安装完整 workspace 的 job 都会先运行仓库自有的 `.github/actions/configure-nexa-remote` action；原生 Landlock job 保留过滤后的安装，因为它不会解析私有包。

该 action 把密钥、GitHub 固定的 Ed25519 主机公钥和独立 SSH 配置写入 runner 临时目录下随机生成且仅所有者可访问的目录。它只导出 `GIT_SSH_COMMAND`，后续步骤不会收到 secret 输入。post action 会验证记录路径确实是 `RUNNER_TEMP` 的子路径；如果目标是链接就只删除链接，否则只递归删除已确认的真实临时目录。secret 缺失时，它会在依赖安装前失败，并准确指出需要修复的仓库设置。

deploy key 只能读取 NEXA Remote，不能写入。GitHub 不会向 fork 与 Dependabot PR 提供仓库 secret，所以这些不受信任的运行无法安装完整私有依赖树。同仓库写入者可以像现有真实 API 凭据一样通过修改 workflow 触及这把密钥；把身份限制为单个只读仓库，可以约束这种 Actions 固有暴露的影响范围。通用的受信任分支与 fork secret 模型由[真实 API CI 决策](../testing/2026-06-19-real-api-e2e-ci.md)负责。

## Alternatives considered

**把维护者的 GitHub token 存成仓库 secret。** 拒绝，因为它的访问权限与轮换周期依附于个人，而且可能超过依赖安装所需的唯一私有仓库。

**公开 NEXA Remote，或把它的包产物提交到公开 Harness 仓库。** 拒绝，因为两种选择都会公开私有源码或可分发字节。公开 fork 的 CI 仍无法消费这项私有定制，这是明确接受的结果，而不是意外的凭据泄漏。

**关闭所有失败的 workflow。** 拒绝，因为这样会删除发行、文档、沙箱和回归证据，却没有让未来 job 能够访问依赖。

## Consequences

受信任的 push、定时、手动和同仓库 PR job 可以在不使用个人凭据的情况下安装固定提交的私有包。deploy key 被轮换或删除时会产生一致的认证失败；workflow 回归测试要求每个完整 workspace 安装都必须先配置它。只要该依赖保持私有，外部 PR 就无法运行完整 NEXA workspace，必须由维护者先集成到受信任分支，再运行完整检查。
