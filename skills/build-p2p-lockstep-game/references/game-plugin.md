# Deterministic Game Plugin

## Move payload

Use a tagged JSON-compatible object and validate `unknown` before reading fields:

```ts
type BoardMove = {
  type: "my-game.move";
  from: { file: number; rank: number };
  to: { file: number; rank: number };
  promotion?: "queen" | "rook" | "bishop" | "knight";
};
```

Validate tag, shape, integers, ranges, enums, ownership, geometry, obstructions,
terminal state, and game-specific restrictions.

## Replay as source of truth

```ts
function buildPosition(history: readonly TurnEntry[]): Position {
  const position = createInitialPosition();
  for (const entry of history) {
    if (!isGameMove(entry.move)) throw new Error("Invalid synchronized history.");
    applyMove(position, entry.move, sideForTurn(entry.turn));
  }
  return derivePositionMetadata(position, history);
}
```

Return board, captures, side, legal moves, last move, check, special rights,
repetition keys, counters, and terminal result. The view never mutates authority.

## Map players to sides

`TurnEntry.player` is browser-relative. Use `lastStart`:

```ts
const sideForPlayer = (
  player: PlayerLabel,
  lastStart: PlayerLabel | null,
): "first" | "second" | null => {
  if (!lastStart) return null;
  return player === lastStart ? "first" : "second";
};
```

Map first to black in Gomoku, red in Xiangqi, and white in chess. Keep canonical
coordinates even when rendering the local side at the bottom.

## Plugin

```ts
import type { GameState, IGamePlugin, PlayerLabel } from "p2p-lockstep-kit-ui";

export const createGamePlugin = (): IGamePlugin => ({
  validateMove(move: unknown, gameState: GameState) {
    if (!isGameMove(move)) return { valid: false, reason: "Invalid move." };
    return validateMoveForPosition(
      buildPosition(gameState.history), move, gameState.lastStart,
    );
  },
  checkWin(gameState, history): PlayerLabel | null {
    return playerForWinningSide(buildPosition(history), gameState.lastStart);
  },
});
```

Register before play. Render from observer snapshots and submit through
`runtime.actions.move(move)`.

## Input and outcomes

Allow input only when connected, `localState === "turn"`, no pending action, the
selection is legal, and the position is not terminal. Disable it while syncing,
offline, awaiting approval, or waiting for the peer.

Current `checkWin` cannot distinguish ongoing from draw. Document a limited
example or extend Session/UI with a generic draw outcome; never fake a winner.

Test malformed moves, ownership, geometry, blockers, captures, self-check where
applicable, terminal rejection, special moves, both starters, undo replay,
serialization round-trip, and identical position hashes.
