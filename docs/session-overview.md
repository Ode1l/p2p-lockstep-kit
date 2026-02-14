# Session Layer Overview

This document summarizes how the session runtime is organized and how it collaborates with the game plugin (`IGamePlugin`). Use it as a guide when navigating `src/session`.

## High-Level Flow

1. **Shell bootstrap** calls `createSessionController` with a game plugin and UI hooks.
2. `controller` wires together:
   - session state (`state/state.ts`)
   - session FSM (`state/fsm.ts`)
   - pending action cache (`state/pending.ts`)
   - command bus + middlewares (`commandRegistry.ts`, `commandMiddleware.ts`)
   - handlers for READY/RESTART/REJOIN/etc. and game move/undo handlers.
3. `flow.ts` takes care of `net.register`/`net.connect` (signaling + WebRTC) and logs progress via UI.
4. Incoming/outgoing envelopes always travel through the command bus → FSM guard → handlers → state/game → message sender.

## Folder Map (`src/session`)

| Path | Responsibility |
| ---- | -------------- |
| `controller.ts` | Composition root; builds all other pieces and exposes UI-facing API (`onReady`, `onStart`, etc.). |
| `flow.ts` | Imperative orchestration for register/connect/retry before gameplay starts. |
| `commandRegistry.ts` | Dispatches envelopes by `type`, running middlewares for guard/logging. |
| `commandMiddleware.ts` | Default log middleware + FSM guard middleware that enforces session phase rules. |
| `controls/connectionControl.ts` | Watches RTC connection state and triggers FSM + UI updates on connect/disconnect. |
| `handlers/` | READY/START/RESTART/REJOIN/REJECT logic. Game-specific handlers (move/undo) live under `src/game/handlers`. |
| `ports/sender.ts` | Serializes session/game envelopes and uses the Net adapter to send them. |
| `ports/notifier.ts` | Thin logging + toast helper used by handlers. |
| `rejoin/` | UI prompts and decision logic for resume/restore flows. |
| `state/state.ts` | Owns runtime session state (peer info, game adapter, cache, ready flags) and bridges to the game plugin. |
| `state/fsm.ts` | Session finite-state machine; tracks OFFLINE/WAITING/READY/GAMING and guards commands. |
| `state/pending.ts` | Stores pending actions (undo/rejoin/restart) for approval flows. |

## Interaction with `IGamePlugin`

- `createSessionState` instantiates the plugin via `plugin.create({ mount, onLocalMove, ... })` and receives an `IGameSession` implementation.
- Game-provided APIs used by the session:
  - `game.applyMove`, `game.undoMove`, `game.reset`
  - `game.getSnapshot` / `game.applySnapshot` for SYNC
  - `game.getRuleGuard()` → exposes `canApplyMove` for legality checks before sending/applying moves
  - `game.getHash()` + `getStatus()` for envelope metadata and UI
- Session never mutates game state directly; it always calls these adapter methods and reacts to their return values (e.g., win detection, hash updates).

## Message Lifecycle

### Local command

```
UI → commandBus.emit(type)
  → FSM guard (local, ensures action allowed in current phase)
  → handler (session or game)
  → state + game adapter mutate state, notifier logs
  → messageSender serializes and sends envelope (session/game domain)
```

### Remote message

```
Peer envelope → NetAdapter parses JSON → commandBus.handleMessage
  → FSM guard (remote) drops illegal messages
  → handler applies payload (ready flag, move, undo, rejoin, etc.)
  → state/game update + notifier feedback (reject, sync request)
```

Game handlers (move/undo) live in `src/game/handlers/*` so the same session infrastructure can be reused by different games by swapping plugins.

## Pending Actions & Approval

Undo/rejoin/restart flows require consent from both peers. `state/pending.ts` tracks the action type and undo count:
- Local request sets `pendingAction` and sends the session message.
- Remote approval (`APPROVE`) pulls from this cache to decide whether to apply undo, send SYNC_STATE, or reset to lobby.
- Remote rejection clears the cache and shows UI feedback.

## Connection States & FSM

`controls/connectionControl.ts` notifies the FSM whenever the WebRTC DataChannel connects or disconnects. The FSM then transitions between:
- `OFFLINE`: not connected or after a disconnect
- `WAITING`: connected but not both ready
- `READY`: both peers ready (allowed to fire START)
- `GAMING`: a match is running or a restore succeeded

Handlers call `fsm.onMatchStart/onMatchEnd` to keep the FSM aligned with gameplay.

This structure keeps responsibilities isolated: network concerns in `flow`/`net`, protocol gating in the FSM + command bus, gameplay legality inside the game plugin.
