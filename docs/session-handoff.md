# Session Handoff

## Current State
- Protocol was split toward session/game concerns.
- `src/utils/protocol/session.ts` exists for session message types/payloads.
- `src/utils/protocol/game.ts` is reduced to gameplay message types (currently `MOVE`).
- `src/utils/protocol/envelope.ts` exists with shared wire envelope + resolver.
- Session sender path was refactored into:
  - `sendSession(...)`
  - `sendGame(...)`
- `MOVE` reject handling is owned by game handler path; session reject handles session actions only.
- Typecheck is green (`pnpm run typecheck`).

## Pending Decisions
- Whether to keep/remove explicit `domain` on wire envelope.
- Exact FSM table for session message gating per state.
- Whether to split `REJECT` into session/game-specific message types.

## Next Recommended Steps
1. Implement `session/fsm` gate in front of command dispatch (state + allowed message map).
2. Keep game pipeline command-based; avoid adding queue unless async races appear.
3. Normalize protocol naming and remove any leftover mixed semantics.
4. Update README diagrams to match final FSM + routing behavior.

## Quick Resume Prompt (for a new machine)
- Goal: finalize clean split between `session` and `game`.
- Constraint: session controls flow, game controls rules.
- Task: implement session FSM gating and align protocol routing accordingly.

