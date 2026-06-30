# p2p-lockstep-kit

`p2p-lockstep-kit` is a browser-first toolkit for deterministic, one-to-one,
turn-based games over WebRTC DataChannel. It provides direct peer pairing,
Ready/Start/undo/restart flows, ordered move history, reconnect synchronization,
responsive Web Components, and a game-plugin boundary for rules and rendering.

The included Gomoku application demonstrates the intended integration. A game
project owns its move schema, deterministic rule replay, and board UI; the kit
owns signaling, the peer session, shared controls, recovery, and status UI.

## Packages

| Package | Responsibility |
| --- | --- |
| [`p2p-lockstep-kit-network`](https://www.npmjs.com/package/p2p-lockstep-kit-network) | WebSocket signaling, WebRTC peer links, registration, and Peer ID resume |
| [`p2p-lockstep-kit-session`](https://www.npmjs.com/package/p2p-lockstep-kit-session) | Two-player FSM, move history, approvals, game-plugin validation, reconnect sync |
| [`p2p-lockstep-kit-ui`](https://www.npmjs.com/package/p2p-lockstep-kit-ui) | Pairing and game pages, share links/QR, status, controls, themes, and runtime facade |

For a normal game application, install the UI package. It composes the Network
and Session packages and re-exports the public game types.

```bash
pnpm add p2p-lockstep-kit-ui
```

The independent package repositories are the npm publishing sources. This
repository is the integrated source snapshot, development playground, and
reference implementation.

## Fastest path: use the included Codex Skill

This repository includes the `build-p2p-lockstep-game` Skill. It teaches Codex
the package boundaries, current runtime API, deterministic plugin pattern,
responsive board requirements, reconnect behavior, tests, and static deployment
checks. With it installed, a developer can ask Codex to build Gomoku, Xiangqi,
international chess, checkers, or another deterministic 1v1 game without first
explaining the kit interfaces.

Install the Skill for the current user:

```bash
mkdir -p ~/.codex/skills
cp -R skills/build-p2p-lockstep-game ~/.codex/skills/
```

Then start a new Codex task with a request such as:

```text
Use $build-p2p-lockstep-game to build a responsive Chinese chess application.
```

The folder at `skills/build-p2p-lockstep-game` is self-contained and can also be
published as its own GitHub repository. The Skill is development guidance for
Codex; it is not a runtime dependency of games built with the kit.

## Minimal application integration

Create a normal Vite web application with an HTML entry, not an npm library.

```html
<p2p-lockstep-app
  class="block min-h-svh"
  game-title="My Game"
  session-id="my-game"
></p2p-lockstep-app>
<script type="module" src="/src/main.ts"></script>
```

```ts
import "p2p-lockstep-kit-ui";
import "p2p-lockstep-kit-ui/style.css";
import type { P2PLockstepAppElement } from "p2p-lockstep-kit-ui";

await customElements.whenDefined("p2p-lockstep-app");
const app = document.querySelector<P2PLockstepAppElement>("p2p-lockstep-app");
const runtime = app?.getRuntime();
const boardHost = app?.getBoardHost();
if (!runtime || !boardHost) throw new Error("Unable to initialize the P2P game shell.");

runtime.setGamePlugin(createGamePlugin());
boardHost.replaceChildren(createGameBoard(runtime));
```

Submit tagged, JSON-serializable moves through `runtime.actions.move(move)` and
render from `runtime.observer` snapshots. See [`playground/gomoku`](playground/gomoku)
for the complete implementation.

## Architecture

```text
game application
  ├─ owns move schema, replay, rules, outcomes, and board rendering
  └─ imports p2p-lockstep-kit-ui
       ├─ composes p2p-lockstep-kit-session
       └─ composes p2p-lockstep-kit-network
            ├─ WebSocket signaling/control plane
            └─ WebRTC DataChannel/data plane
```

The current product is direct 1v1 pairing. It has no public lobby, room browser,
matchmaking service, or server-owned game state. Signaling exchanges WebRTC
connection information but does not become the game authority.

Supporting three or more players is a separate protocol design involving stable
participant identity, membership, multi-peer topology, ordering, conflict
resolution, private state, and new sync semantics. It is not implemented by
looping over the current `remote` player.

## Run the Gomoku reference application

```bash
cd playground/gomoku
pnpm install
pnpm test
pnpm typecheck
pnpm dev
```

Create a production build with `pnpm build`. It must contain `dist/index.html`
and hashed assets. Cloudflare Pages can use `pnpm build` with `dist` as the output
directory; a static application does not require Wrangler.

## Scope and constraints

- Browser-only, deterministic, turn-based 1v1 games.
- Moves must be serializable and fully replayable from ordered history.
- Remote payloads are untrusted and must be validated by the game plugin.
- A share URL or pending handshake is not an active match.
- Network identity resume and game-state synchronization are separate steps.
- Mobile and desktop layouts are both first-class targets.
- The current plugin represents a winner but not a draw; extend the generic
  Session outcome contract for draws rather than inventing a fake winner.

## Repository layout

```text
src/network/                         integrated Network source snapshot
src/session/                         integrated Session source snapshot
src/ui/                              integrated UI source snapshot
playground/gomoku/                   reference Vite application
skills/build-p2p-lockstep-game/      reusable Codex Skill
```

## License

Licensed under the [GNU General Public License v3.0 only](LICENSE)
(`GPL-3.0-only`).
