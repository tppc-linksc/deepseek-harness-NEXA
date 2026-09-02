# Agent Note: Authenticate the private NEXA Remote dependency in CI

Status: implemented

English | [中文](2026-09-02-private-nexa-remote-ci-authentication.zh.md)

## Problem

The public NEXA Harness repository depends on one commit-pinned package from the private `tppc-linksc/NEXA-Remote` repository. Local development resolves its SSH URL through a maintainer identity, but GitHub-hosted runners have no such identity. Every workflow that installs the complete workspace therefore fails before its own checks start, and a general personal token would give routine build jobs broader repository access than this dependency requires.

## Decision

`tppc-linksc/NEXA-Remote` grants one read-only deploy key to `tppc-linksc/deepseek-harness-NEXA`. The Harness repository stores the private half as the `NEXA_REMOTE_DEPLOY_KEY` Actions secret. Every job that installs the complete workspace runs the repository-owned `.github/actions/configure-nexa-remote` action first; native Landlock jobs retain their filtered install because it does not resolve the private package.

The action writes the key, GitHub's pinned Ed25519 host key, and an isolated SSH configuration into a random runner-temporary directory with owner-only permissions. It exports only `GIT_SSH_COMMAND`; later steps do not receive the secret input. Its post action validates that the recorded path is a real child of `RUNNER_TEMP`, unlinks a link-shaped target, and recursively removes only the known real temporary directory. A missing secret fails before dependency installation with the exact repository setting to repair.

The deploy key can read only NEXA Remote and cannot write it. GitHub withholds repository secrets from fork and Dependabot pull requests, so those untrusted runs cannot install the complete private dependency tree. Same-repository writers can reach the key through workflow changes, as with the existing real-API credential; limiting the identity to one read-only repository bounds that inherent Actions exposure. The [real-API CI decision](../testing/2026-06-19-real-api-e2e-ci.md) owns the general trusted-branch and fork-secret model.

## Alternatives considered

**Store the maintainer's GitHub token as a repository secret.** Rejected because its access and rotation follow a person and can exceed the one private repository needed by dependency installation.

**Make NEXA Remote public or commit its package artifact into the public Harness repository.** Rejected because either choice publishes private source or distributable bytes. Public fork CI remains unable to consume this private customization, an explicit consequence rather than an accidental credential leak.

**Disable every failing workflow.** Rejected because it removes release, documentation, sandbox, and regression evidence while leaving the dependency inaccessible to future jobs.

## Consequences

Trusted push, scheduled, manual, and same-repository pull-request jobs can install the pinned private package without a personal credential. A rotated or removed deploy key produces one consistent authentication failure, and the workflow regression test requires every complete-workspace install to configure it first. External pull requests cannot run the complete NEXA workspace while the dependency remains private; they require maintainer integration into a trusted branch before the full checks run.
