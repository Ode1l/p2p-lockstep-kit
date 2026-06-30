---
name: build-p2p-lockstep-game
description: Build, adapt, test, or deploy deterministic 1v1 turn-based browser game applications with p2p-lockstep-kit-ui and its Session runtime. Use for games such as Gomoku, Xiangqi, international chess, checkers, or similar games; for implementing an IGamePlugin, replaying move history, mounting a responsive board, wiring runtime actions and observers, or debugging pairing, Ready/Start, undo/restart, reconnect/sync, Vite builds, Tailwind, and Cloudflare Pages deployment.
---

# Build a P2P Lockstep Game

Build a private Vite application around `p2p-lockstep-kit-ui`. Keep game rules,
move payloads, deterministic replay, and board rendering in the app. Let the kit
own signaling, pairing, generic controls, session protocol, and recovery.

## Load only the references needed

- Read [references/integration.md](references/integration.md) before wiring the app or using the runtime API.
- Read [references/game-plugin.md](references/game-plugin.md) before defining moves, replay, validation, or outcomes.
- Read [references/app-and-deployment.md](references/app-and-deployment.md) when scaffolding, styling, browser-testing, building, or deploying.
- Read [references/architecture.md](references/architecture.md) when changing boundaries, reconnect behavior, or discussing multiplayer.
- Read [references/chess-examples.md](references/chess-examples.md) only for Xiangqi or international chess.

## Workflow

1. Inspect the target app and installed package declarations. Resolve current published versions; never assume an old example's versions are current.
2. Create a private Vite web application with `index.html`, `src/main.ts`, `private: true`, and a build that emits `dist/index.html`. Do not configure library mode.
3. Install `p2p-lockstep-kit-ui`. Prefer its re-exported game types; import Session directly only for APIs that UI does not re-export.
4. Mount only the game board into `app.getBoardHost()`. Use `app.getRuntime()`; do not create another Network client or Session.
5. Define a tagged, JSON-serializable move and strict `unknown` guard. Include every choice required for deterministic replay.
6. Make ordered `snapshot.history` the source of truth. Derive the complete position, side, last move, special rights, counters, and terminal result from history.
7. Register one deterministic `IGamePlugin` before play. Validate against the position before the proposed move; keep rules independent of DOM and browser state.
8. Render only from observer snapshots and submit only through `runtime.actions.move(move)`. Let generic UI own Ready, Start, undo, restart, approvals, themes, connection status, and sync UI.
9. Gate input on connection, local turn, no pending action, a legal move, and non-terminal state.
10. Test replay first, then UI, both starter mappings, two peers, undo/restart, stale invites, reconnect, mobile resume, themes, and production output.
11. Run `node <skill-dir>/scripts/verify-app.mjs <app-dir>`, frozen install, typecheck, tests, and build.

## Preserve these invariants

- A share URL or `requesting` handshake is not a connected match. Show a fresh game only after connection; preserve an active game while reconnecting.
- Peer ID resume restores signaling identity, not board history. Session `SYNC_REQUEST` / `SYNC_STATE` restores the timeline.
- `local` and `remote` are browser-relative. Derive first/second side from `lastStart`; never hardcode `local` as black, red, or white.
- Treat remote moves and synchronized history as untrusted. Reject malformed or illegal moves before mutation.
- Keep every rule-affecting fact in history or derive it from history. Never use an unsynchronized mutable board as authority.
- Use public `--lock-*` theme tokens and built-in Day/Night controls. Do not target private UI DOM or generated utility classes.
- Preserve peer, connection, readiness, session, turn, history, pending-action, sync, and error information.
- Do not invent a lobby, public room browser, matchmaking server, or server-owned game state.
- Do not encode a draw as a fake winner. Extend the generic outcome contract or document the example's limited terminal scope.

## Scope boundary

Keep this Skill scoped to two peers. Multiplayer requires stable Participant IDs,
membership, multi-peer transport, ordering, conflict resolution, new approvals,
private-state rules, and redesigned sync/UI semantics.

## Completion criteria

- Serialized history reproduces the position exactly.
- Local and remote illegal moves are rejected consistently.
- Both peers agree on sides, turn, history, outcome, undo/restart, and recovered state.
- Fresh/stale invites stay on pairing until connected; active matches recover after page resume.
- 390px phone and desktop layouts work without clipped controls or board overflow.
- Tests, typecheck, frozen install, production build, and the included verifier pass.
