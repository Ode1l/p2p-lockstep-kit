# Architecture Notes

## Scope
- This project targets 1v1 turn-based board games (gomoku/chess-like).
- Keep layers clean and responsibilities single-purpose.

## Layer Boundaries
- `network`: transport + connection state only (no game/session semantics).
- `session`: lifecycle orchestration (ready/start/rejoin/sync/approve/reject), protocol gating.
- `game`: turn/rule validation, board mutation, win logic.

## Protocol Direction
- Split protocol by concern, not by folder convenience.
- `session` messages: lifecycle control, no mandatory `turn`.
- `game` messages: gameplay actions (`MOVE` etc.), use `turn/stateHash`.
- `sid` belongs to session scope; game payload should not carry `sid`.
- `domain` field is optional; current preference is routing by unique `type` set.

## Control Model
- Session should use FSM as the primary gate:
  - `WAITING`, `READY`, `GAMING`, `OFFLINE`.
  - Each state explicitly defines allowed incoming/outgoing message types.
- Game can stay command-driven with minimal turn states:
  - `MY_TURN`, `PEER_TURN`, `ENDED` (optional `SYNCING`).

## Design Principles (agreed)
- No empty wrapper layer.
- No duplicated routing/validation in multiple places.
- Session validates protocol flow; game validates gameplay legality.
- Rule checks should be in rule components (`RuleGuard`/rule policy), not scattered in handlers.

