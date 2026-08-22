# Agent Note: Make NEXA Remote a seamless thin client

Status: implemented

English | [中文](2026-08-22-nexa-remote-thin-client.zh.md)

## Problem

The first NEXA Remote surface exposed implementation details as product steps. Users had to open Settings, inspect Relay state and identifiers, scan, compare a fingerprint, confirm again on the computer, acknowledge pairing success, and then enter a session. Reloading the Mini Program could lose that transition state. This made a secure remote extension feel like a separate system and obscured the core fact that the computer, not the phone, owns and executes every task.

## Decision

Keep `qrcode-remote` as the Host-owned Cordis runtime component and the only cryptographic identity owner, but move its user entry from Settings to one `sidebar.footer.action` named **Connect mobile**. Clicking the action opens a compact popover containing an automatically generated WeChat Mini Program code and one allow-connection switch. Relay endpoints, computer IDs, fingerprints, reconnect controls, pending proposals, and paired-device management remain available only to development diagnostics or the typed Host control plane, not the normal product UI.

Treat opening the popover and issuing its challenge as the computer user's explicit, short-lived consent to one matching pairing proposal. The existing signed two-phase protocol remains: the phone signs its proposal and the computer signs the confirmation. The Host may submit that confirmation automatically only when the proposal exactly matches the unexpired challenge authorized by the current popover. The authorization is single-use and is cleared on success, expiry, replacement, or shutdown. A Relay ticket alone never authorizes a peer.

Make the WeChat Mini Program a strict thin client. WeChat scanning launches the Mini Program, the bootstrap exchanges `scene`, completes the background handshake, restores the encrypted peer, and immediately opens the latest desktop session. There is no primary in-Mini-Program scanner, fingerprint screen, pairing-success page, or enter-session button. The mobile information architecture mirrors desktop workspaces, sessions, conversation events, questions, and approvals with responsive navigation and a fixed composer. It may request an operation, but it never creates a local session, runs an Agent, calls a model, touches project files, or executes a tool. If the computer is unavailable, execution is unavailable.

## Alternatives considered

**Keep the full Settings console and improve its styling.** Styling cannot fix a workflow whose product surface asks users to understand Relay and identity internals. Those controls are useful for diagnostics but are not normal tasks.

**Remove the computer confirmation signature.** This would make possession of a Relay ticket sufficient and weaken the pairing boundary. Automating a challenge-bound computer signature preserves the protocol guarantee while removing the redundant visible click.

**Give the Mini Program a local task runtime for responsiveness.** This would create a second source of truth, duplicate the Agent loop and security policy, and make reconnect reconciliation ambiguous. Responsiveness must come from compact projections, incremental events, optimistic input presentation, and clear offline state instead.

## Consequences

- The runtime component inventory still lists `qrcode-remote`, and the normal user entry is one sidebar-footer action rather than a Settings section.
- Opening the action automatically yields a direct-launch WeChat Mini Program code; the popover exposes only the code, human connection state, and an allow-connection switch.
- WeChat scanning completes the challenge-bound signed pairing in the background and opens the latest desktop session without another user action.
- A proposal for a different, expired, replaced, or already consumed challenge is never auto-confirmed.
- The Mini Program renders only computer-sourced workspaces, sessions, history, live events, questions, and approvals; every mutation is a request to the desktop Host and every final state comes back from the computer.
- Settings, package docs, subsystem docs, product docs, tests, and snapshots describe the same thin-client boundary.

The simpler flow makes the explicit desktop act of opening the code and the exact challenge match security-critical, so tests pin that authorization cannot float across challenges. Direct navigation exposes loading and reconnect races that the old intermediate pages masked, requiring deterministic bootstrap and peer-restoration coverage. The compact popover intentionally gives up inline diagnostics; failures use short user copy and developer-visible logs instead of returning technical fields to the product UI.

## Testing

The desktop client now registers one `sidebar.footer.action` and renders a compact code popover instead of a Settings section. `qrcode-remote` issues an exact, single-use authorized challenge, while the Host preserves the signed two-phase protocol and rejects mismatched or stale proposals. The Mini Program bootstrap restores or establishes the encrypted peer invisibly and re-launches directly into a mobile projection of the desktop session.

Focused client and runtime tests pass (2 files, 13 tests), targeted TypeScript and Oxlint checks pass, and the full GUI suite passes (289 files, 3,995 tests, 1 skipped). The complete Web build also passes. The replay Web bootstrap snapshot still fails before remote UI mounting because the NEXA Local Build does not contain the official DeepSeek logo hard-coded by that upstream snapshot; this baseline branding mismatch was not hidden by changing the unrelated assertion.
