# p2p-lockstep-kit

Integrated source snapshot for the P2P lockstep kit. The independent network,
session, and UI repositories remain the authoritative npm publishing sources.

```text
src/network  WebRTC transport and signaling
src/session  lockstep state and synchronization
src/ui       Web Components UI and Tailwind styles
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

This repository is private and does not publish npm packages. It is used for
full-kit development, integration testing, demos, and portfolio presentation.
