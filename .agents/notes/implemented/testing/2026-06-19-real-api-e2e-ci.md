# Agent Note: Real-API e2e in CI against the external DeepSeek API

Status: implemented

English | [中文](2026-06-19-real-api-e2e-ci.zh.md)

## Problem

The harness leans hard on real-API tests by policy: [docs/testing.md](../../../../docs/testing.md) argues that a no-key suite proves the plumbing but not the product, and the [ACP inject postmortem](../../../../docs/postmortem/0001-acp-default-export-drops-inject.md) is the standing proof — 178 keyless tests stayed green while a real ACP client session crashed instantly. The real-API e2e suite (`pnpm run test:e2e`, the `*.e2e.ts` files) exists precisely to close that gap: it drives the agent against the live DeepSeek API — real model calls, real bash tools, multi-turn, resume, ACP-over-stdio.

The official repository's default gate ([.github/workflows/ci.yml](../../../../.github/workflows/ci.yml)) deliberately carries no model API credential. `test:e2e` self-skips without a key (`describe.skipIf(!process.env.DEEPSEEK_API_KEY)`), so adding it there would report green without exercising the real suite. A separate secret-bearing workflow is required to make real-API coverage a merge signal. A downstream distribution may need limited installation credentials for its own private dependencies; [NEXA's read-only deploy-key decision](../process/2026-09-02-private-nexa-remote-ci-authentication.md) owns that separate concern and its fork limitation.

## Decision

A dedicated workflow, [.github/workflows/e2e.yml](../../../../.github/workflows/e2e.yml), separate from ci.yml, runs only `pnpm run test:e2e` against the external API using a repo secret, on trusted events, with a preflight that converts a missing secret into a loud failure instead of a false green. The official `deepseek-ai/deepseek-harness` repository enables the job by identity; a downstream fork must configure its own key and set `DSH_REAL_API_E2E_ENABLED=true`. The keyless workflow remains separate so forkable quality gates and secret-consuming real-API gates keep different trigger and credential policies.

### A separate workflow, not a job in ci.yml

ci.yml's value in the official repository is that it carries no model API credential and gives contributors a complete keyless signal. Adding the external-API job there would couple that gate to model credential availability and a different trigger policy. Keeping the model-secret work in its own file isolates its secret, trigger, and concurrency policy. A downstream distribution that adds a private dependency can no longer promise complete CI to external forks; its narrowly scoped installation credential does not change the separation of model API access from ordinary checks.

### Cost is not the constraint; reliability is

Internal inference cost is not the limiting constraint, so the workflow optimizes for coverage and signal. It runs every matching `*.e2e.ts` file on multiple triggers and every trusted PR, implementing the [docs/testing.md](../../../../docs/testing.md) with-key policy.

### Triggers: trusted events only

`workflow_dispatch` + `push` to `main`/`master` + nightly `schedule` (`17 0 * * *`, 08:17 Asia/Shanghai) + `pull_request`. Push gives a post-merge signal; schedule catches external-API drift; dispatch is the manual escape hatch; and trusted pull requests get a pre-merge gate. The job-level repository guard makes those triggers a clean skip in an unconfigured downstream fork. An enabled repository's pre-merge signal deliberately accepts the larger key-exposure surface described under § Security.

### The untrusted-PR gate

GitHub withholds repo secrets from two kinds of PR: those from **forks**, and **Dependabot** PRs (same-repo branch, so `head.repo.fork == false`, but secrets are still withheld). A job-level `if:` skips the whole job for both:

```
github.event_name != 'pull_request'
  || !(github.event.pull_request.head.repo.fork || github.event.pull_request.user.login == 'dependabot[bot]')
```

The Dependabot clause keys on the PR **author** (`pull_request.user.login`), not `github.actor` (the run trigger): a maintainer who reopens or re-runs a Dependabot PR would make `github.actor` a human while the PR is still keyless, and an author-based test stays correct across that. A job skipped by a **job-level** `if:` reports as a *successful* check (unlike a workflow/trigger-level skip, which stays pending), so this workflow is safe to mark as a required status check if desired — a fork/Dependabot PR's skipped-but-green check does not block the merge.

The gate is a *clean-skip nicety*, not the secret's security boundary (see § Security — the boundary is GitHub's own fork-secret withholding under `pull_request`). Without the gate, forks still could not read the key; they would just hit a confusing preflight hard-fail and waste compute.

### Preflight: fail loud, never false-green

Because the job only runs on trusted events where the secret is expected, the preflight is an unconditional presence check: empty key → `exit 1` with a `::error::` annotation naming the secret to configure. This is the crux that makes a self-skipping suite safe to gate on. Without it, a deleted/renamed/misconfigured secret would make `test:e2e` skip every real suite and report all-green — a silent regression of the entire safety net. The guard turns "secret missing" from an invisible false pass into a visible failure. (Its correctness was verified live: the run before the secret existed failed at exactly this step.)

### Secret mapping and hygiene

The repo secret is named `DEEPSEEK_API_KEY_EXTERNAL`; it is mapped to the `DEEPSEEK_API_KEY` env var the adapters and tests read (`process.env.DEEPSEEK_API_KEY`). The distinct secret name documents intent (this is the *external* public-API key, not an internal-endpoint key) and lets an internal-endpoint key coexist later without collision. Hygiene choices, each defensive:

- **Step-scoped secret.** `DEEPSEEK_API_KEY` is set in the `env:` of only the preflight and e2e steps, never job-level — so checkout/setup-node/install never see it. A compromised install-time lifecycle script in a dependency cannot read a secret that isn't in its environment.
- **`permissions: contents: read`.** The job only reads the repo to run tests; it needs no write scopes (no PR comments, no status writes), so the `GITHUB_TOKEN` is dropped to least privilege.
- **`DEEPSEEK_BASE_URL` pinned** to `https://api.deepseek.com` on the e2e step. The adapter would default to this when unset ([packages/llm/llm-deepseek/src/index.ts](../../../../packages/llm/llm-deepseek/src/index.ts) `PUBLIC_BASE_URL`), but pinning is self-documenting and hermetic — a stray repo-root `.env` (which `vitest.e2e.config.ts` loads if present) cannot silently redirect the run to another endpoint.
- **No secret echoed.** The preflight prints only `DEEPSEEK_API_KEY present.` — not the value or its length.

### Scope, runtime shape

The job runs only `test:e2e` on Node 24; keyless gates and version compatibility belong to the main CI workflow. Tests run unbuilt through the workspace paths map with a bounded configurable worker pool, per-test retries, and a job timeout. Superseded PR runs are cancelled, while push and scheduled runs complete for post-merge signal.

The DeepSeek native `web_search` probe is registered but skipped. The live Anthropic-compatible endpoint can return a successful response without structured source blocks, so its positive-source assertion is not a reliable merge signal; unit coverage still pins response parsing, but CI does not prove the live source-block wire shape.

## Security

The external API secret requires a recorded threat model because access differs between same-repository, fork, and Dependabot pull requests.

### Who can reach the secret

- **No write access (fork PRs): cannot.** Two independent facts block it. First, the workflow uses `pull_request`, **not** `pull_request_target` — GitHub does not pass repo secrets to fork-PR runs of `pull_request`, so `secrets.DEEPSEEK_API_KEY_EXTERNAL` resolves to empty on a fork runner. Second, the `if:` gate skips fork PRs entirely. The withholding is the real boundary; the gate is defense-in-depth and UX.
- **Write (push) access: can.** A same-repo branch PR receives secrets, so a write-access author could modify test code (or an install lifecycle script, or the workflow YAML on their branch) to exfiltrate the key. This is **inherent to GitHub Actions, not introduced here**: anyone with push access to any repo can already exfiltrate any of its Actions secrets by authoring a workflow. Write access ⇒ secret access, always. The mitigation lives in who is granted write and in branch protection, not in this file.

So "everyone who could open a PR can steal it" is false: only the write-access set can, and that set could already steal any secret the repo holds.

### The residual exposure the `pull_request` trigger adds

Because PR runs are enabled, the key is handed to **the code on a write-access author's PR branch** before merge. This is a larger surface than `push` + `schedule` + `workflow_dispatch`, accepted for a pre-merge signal within the trusted write set. If that calculus changes, drop the `pull_request` trigger while retaining post-merge, nightly, and on-demand coverage.

### Public repository controls

The secret stays protected from the public **through this workflow**: fork PRs receive no secret, and maintainer approval to run a fork PR does not hand over the key. Repository logs are public, so the workflow never echoes the secret or its length. The `pull_request_target` trigger is prohibited because it could combine base-repository secrets with untrusted fork code.

The repository controls that preserve this model are:

- Keep Settings → Actions → *"Send secrets to workflows from fork pull requests"* **off**.
- Keep the workflow free of `pull_request_target`; the `SECURITY —` comment in e2e.yml records the prohibition.
- Rotate `DEEPSEEK_API_KEY_EXTERNAL` after suspected exposure or a repository visibility change.
- Consider a GitHub Environment with required reviewers if the trusted-write set becomes broader than the accepted pre-merge exposure.

The NEXA distribution's read-only dependency key follows the same fork withholding rule but has a separate, single-repository blast radius documented in its own Agent Note.

## Alternatives considered

- **An external-API secret inside ci.yml** — rejected: it would couple ordinary checks to model credential availability and a different trigger/concurrency policy. NEXA's read-only dependency key is installation infrastructure governed by its separate decision.
- **Omitting the `pull_request` trigger** (the smaller key-exposure surface) — rejected for the pre-merge signal; the Security section carries the accepted exposure analysis.

## Consequences

A second CI workflow and a dedicated repo secret to maintain on every repository that opts in. The real-API suite gates merges (pre-merge on trusted PRs, post-merge on the main branch) and runs nightly where enabled, so a real break in the agent's interaction with the external API surfaces in CI rather than only in a developer's local run — at the cost of real (but internally free) API calls on every trusted PR and merge. An unconfigured downstream fork reports a clean skip; on an enabled repository, the preflight makes secret misconfiguration self-announcing instead of silently disabling the net.

The design carries a documented constraint surface: the `pull_request` trigger's key-exposure tradeoff (drop it to harden), the `if:` gate's dependence on the author-based Dependabot test, and the hard prohibition on `pull_request_target`. The public-repository controls above are its operational companion; this Agent Note is the place a future maintainer should re-read before changing the trigger set or repository visibility.

The scheduled trigger auto-disables after 60 days of repo inactivity (a GitHub behavior); push/PR/dispatch are backstops, and an active monorepo will not hit it. Runner egress to `https://api.deepseek.com` is assumed — GitHub-hosted `ubuntu-latest` has it; an egress-restricted self-hosted runner would need connectivity confirmed before relying on the nightly.
