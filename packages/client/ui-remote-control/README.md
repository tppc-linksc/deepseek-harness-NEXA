# @deepseek-ai/dsh-client-ui-remote-control

English | [中文](README.zh.md)

Browser-side connection surface for `@deepseek-ai/dsh-qrcode-remote`. It contributes a 36px **Connect mobile** icon to `sidebar.footer.trailing`, on the same footer row and immediately to the right of Settings. Opening the icon creates a fresh short-lived WeChat Mini Program code and presents it in a compact popover. The only visible preference is whether this computer accepts mobile connections. Relay URLs, computer IDs, fingerprints, paired-device administration, protocol state, and manual confirmation do not enter the product surface.

The computer is the only execution authority. The Mini Program mirrors computer-owned workspaces, Sessions, messages, tool output, status, and approval requests; phone input is admitted into the selected computer Session. The two-party signed pairing exchange remains in the Host protocol, but opening the computer popover authorizes only its exact fresh challenge, allowing a successful WeChat scan to enter the mirrored Session without another confirmation or **Enter session** step. A legacy payload fallback is never presented as a user-scannable product code.

The Host connection follows authenticated transport state instead of the presence of a socket object. A lost Relay connection schedules bounded exponential reconnection, opening the popover restarts a stale Host, and a successful state refresh clears any transient connection error. Desktop snapshots include every non-archived Session, including a new blank Session, so the Mini Program drawer is a faithful projection of the computer rather than a separately filtered task list.

## Model Experience

None, as browser controls register no prompt, schema, or model context; the Host service owns any separately admitted phone input.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The popover can report connection availability, but it cannot provision DNS, TLS, Redis, WeChat credentials, or a public Relay deployment.
- QR pairing, reconnection after Mini Program suspension, and SOTER approval still require real-device release validation.
