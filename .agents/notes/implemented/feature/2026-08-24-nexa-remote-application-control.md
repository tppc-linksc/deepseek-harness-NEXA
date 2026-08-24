# Agent Note: Make NEXA Remote an application-level controller

Status: implemented

English | [中文](2026-08-24-nexa-remote-application-control.zh.md)

## Problem

The seamless thin-client flow made remote observation and existing-Session input usable, but it prevented common away-from-computer work: starting a Session in an existing workspace, registering another computer project, creating a project directory, and changing safe settings. Treating those requests as forbidden because the phone does not execute conflated execution ownership with control. Reproducing arbitrary desktop filesystem access or a second mobile runtime would solve the interaction gap by weakening the computer's authority and security boundary.

## Decision

NEXA Remote is an application-level controller for one paired DeepSeek Harness computer. The Mini Program uses mobile-adapted navigation and presentation while preserving desktop function semantics. It observes computer state and submits versioned, authenticated, idempotent control requests; the computer validates, executes, persists, and publishes every authoritative result. The seamless WeChat scan and background pairing flow from the [thin-client decision](2026-08-22-nexa-remote-thin-client.md) remains the only normal connection path.

## Execution authority

The phone never runs an Agent, calls a model, executes a tool, stores an authoritative Session or workspace, or mutates project files directly. It cannot continue execution while the paired computer is offline. Relay routes opaque encrypted frames and cannot turn a phone request into a DSH operation. The Host publishes capabilities from the adapter methods that are actually available and rejects undeclared actions.

## Remote actions

The control plane covers Session creation, instruction submission, active-run cancellation, approval decisions, safe workspace registration or creation, and structured settings. Session and workspace mutations re-read the computer snapshot after success instead of inserting optimistic mobile records. Approval grants remain one-shot and use the existing DSH approval service. Ordinary user-question answering is absent until it has an equivalent typed DSH route and therefore is not advertised as a capability.

## Workspace and settings safety

Workspace browsing starts at computer-configured roots and returns short-lived opaque directory references rather than absolute paths. The Host revalidates canonical containment, device identity, symlinks, sensitive directories and names for every request. P0 permits directory listing, registration of an existing directory, or creation of one directory level; it omits move, rename, delete, upload and arbitrary file I/O. Settings carry Host-owned descriptors and risk labels. P0 allows the computer name, keeps sensitive settings local-only, and uses a digest plus compare-and-swap revision to reject stale or altered writes.

## Alternatives considered

**Keep the Mini Program read-only except for send and stop.** This preserves the smallest control surface but fails the primary away-from-computer workflow whenever the desired project or Session does not already exist.

**Stream the desktop screen and input.** Screen remoting preserves every pixel but produces a poor phone interface, exposes unrelated desktop content, and bypasses DSH's typed admission and approval boundaries.

**Run a second Agent runtime on the phone or in Relay.** A second runtime permits offline mobile execution but creates another authority for credentials, files, Sessions and tools. It also contradicts the deployment promise that work stays on the paired computer.

## Consequences

Users gain desktop-equivalent control semantics without desktop-sized interaction chrome or a second execution environment. Capability negotiation, idempotency, opaque directory references and settings revisions add protocol and adapter complexity, and a computer must remain reachable for every operation. The deliberate filesystem and settings allowlists mean some desktop actions remain local-only until a separate security decision expands them.

The package README and [remote-control subsystem reference](../../../../docs/subsystems/remote-control.md) own the current consumer and protocol contracts. Focused tests pin control-result replay, authoritative running state, Session creation, directory containment, one-level creation, settings allowlists, digest validation and revision conflicts; real-device WeChat interaction and the packaged desktop remain release verification requirements.
