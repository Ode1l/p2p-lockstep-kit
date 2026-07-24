# p2p-lockstep-kit-multiui

Framework-free lobby and game-shell UI for
[`p2p-lockstep-kit-multisession`](https://github.com/Ode1l/p2p-lockstep-kit-multisession).

The package owns browser connection setup, invitations and QR codes, player
profiles, the pre-game lobby, Ready/Start controls, connection recovery,
restart voting, the participant panel, and a stable game mount. It does not own
game rules or game-specific rendering.

## Install

```bash
pnpm add p2p-lockstep-kit-multisession p2p-lockstep-kit-multiui
```

## Use

```html
<p2p-lockstep-multi-app id="game"></p2p-lockstep-multi-app>
```

```ts
import "p2p-lockstep-kit-multiui";
import "p2p-lockstep-kit-multiui/style.css";
import type { P2PLockstepMultiAppElement } from "p2p-lockstep-kit-multiui";

const app = document.querySelector<P2PLockstepMultiAppElement>("#game")!;
const runtime = await app.configure({
  game: {
    title: "My game",
    configuration,
    plugin,
  },
});

mountGame({ mount: app.getBoardHost(), runtime });
```

A direct visit creates the host. Invitation links contain `?host=<peer-id>`;
every participant continues to share the host's invitation URL.

## Release check

```bash
pnpm release:verify
npm publish --dry-run
```

Actual npm publication is intentionally left to the package owner.
