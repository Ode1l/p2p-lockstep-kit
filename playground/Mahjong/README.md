# Mahjong

Four-player Sichuan Mahjong built as an application on top of the two reusable
packages:

- `p2p-lockstep-kit-multisession` — deterministic host-authoritative session
- `p2p-lockstep-kit-multiui` — browser connection, lobby, invitation, and shell

The project itself owns Mahjong tiles, rules, commands, deterministic plugin,
table rendering, prompts, scoring presentation, and game-specific styles.

## Install and run

After both packages have been published:

```bash
pnpm install
pnpm dev
```

For local package development, install the packed `.tgz` files produced by the
two sibling package repositories before running the same commands.

The dev server listens on the LAN. A direct visit creates the host; every player
shares the host invitation URL and QR code.
