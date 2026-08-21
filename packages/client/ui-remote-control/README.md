# @deepseek-ai/dsh-client-ui-remote-control

English | [中文](README.zh.md)

Browser-side settings surface for `@deepseek-ai/dsh-qrcode-remote`. It contributes the **Remote Control** section to `settings.section` and uses the generated `remoteControl` Remote namespace for every Host action.

The section shows Relay status and the non-secret computer ID, edits the enable switch and computer name, automatically generates and refreshes an expiring WeChat Mini Program code after Relay connection, confirms a pending phone on the computer, and revokes paired phones. The managed production endpoint is never shown or editable; an explicit Host development flag enables the Relay field for local and self-hosted testing. A labeled in-Mini-Program QR fallback appears only when the Relay cannot generate a WeChat code. It polls only while the section is mounted. Private identity and session keys never cross the Remote boundary.

## Model Experience

None, as browser controls register no prompt, schema, or model context; the Host service owns any separately admitted phone input.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The section can validate and display a Relay connection, but it cannot provision DNS, TLS, Redis, or a public Relay deployment.
- QR pairing and WeChat SOTER still require real-device release validation.
