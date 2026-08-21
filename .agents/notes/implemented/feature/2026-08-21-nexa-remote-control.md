# Agent Note: Integrate NEXA Remote Control

Status: implemented

English | [中文](2026-08-21-nexa-remote-control.zh.md)

## Problem

The NEXA Remote WeChat Mini Program and Relay existed as a separate repository, but DeepSeek Harness NEXA had no production Host adapter or product surface for it. Pairing required a separate QR generator, users could not inspect or revoke phones inside settings, and phone instructions had no defined route into the same admission and approval boundaries as local Web input.

## Decision

Add `@deepseek-ai/dsh-remote-control` as the Host-owned integration boundary. It pins the reviewed NEXA Remote commit, owns the computer identity and peer store, connects to the Relay, creates expiring pairing QR payloads, requires computer-side confirmation, revokes paired phones, and exposes only browser-safe state and actions through the generated `remoteControl` Typert namespace. Its state file is atomically replaced with owner-only `0600` permissions; private identity material and channel keys never cross the Remote boundary.

Remote phone instructions use `ctx.apiProxy.sessions.prompt` in queue mode and wait for the addressed Agent to become idle. Stop requests use the existing cancel route. The adapter accepts only the explicit `append_instruction` and `stop` action vocabulary. It forwards existing Session events without creating a second transcript. Approval requests participate as a prepended `approval/request` answerer only while a paired phone is connected; an unavailable phone delegates to the next local answerer, and a phone grant maps only to `allowed-once`.

Add `@deepseek-ai/dsh-client-ui-remote-control` as a dedicated settings section named **Remote Control** / **远程操控**. It configures the Relay and computer name, reports connection errors, generates and displays the QR code, confirms the pending phone on the computer, and revokes devices. Polling exists only while the section is mounted and never returns secrets. The Web bundle and desktop composition that inherits it mount both packages. First launch is opt-in; environment values may seed defaults, while saved preferences become authoritative.

## Alternatives considered

**Keep a standalone QR generator.** This leaves pairing outside the product's settings and duplicates configuration and identity ownership. It also makes confirmation and revocation harder to discover.

**Let the Mini Program call the Harness Web API directly.** This would couple an untrusted phone surface to the browser transport and duplicate session admission, cancellation, and approval rules. The Host adapter keeps the computer authoritative and reuses those existing paths.

**Treat Relay delivery as approval.** End-to-end encryption proves the paired peer, not user intent for a particular high-risk action. Pairing and per-request approval therefore remain separate, with explicit computer confirmation during pairing and one-shot outcomes for remote approvals.

**Enable the Relay connection by default.** A fresh installation usually has no production Relay configured. Opt-in startup avoids noisy localhost failures and unexpected outbound connections while keeping the settings workflow immediately available.

## Consequences

QR generation is now part of DSH-N settings instead of a separate operator tool, and the same feature is present in Web and desktop compositions. The browser sees a narrow typed control plane; session mutation and approval decisions remain Host-owned. The package adds a pinned cross-repository dependency on NEXA Remote and a local private state file that must remain compatible across upgrades.

This implementation is not by itself a public-release clearance. The local secret store is permission-restricted rather than backed by Keychain or DPAPI. WeChat real-device networking, SOTER biometric approval, public `wss://` termination, and durable Redis Relay deployment remain explicit release gates.
