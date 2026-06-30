# Xiangqi and International Chess

Keep package/UI integration identical. Change initial position, coordinates, move
schema, rules, board geometry, outcome text, and tests.

## Xiangqi

```ts
type XiangqiMove = {
  type: "xiangqi.move";
  from: { file: number; rank: number };
  to: { file: number; rank: number };
};
```

Map starter to red. Cover palace restrictions, advisor/elephant movement,
elephant-eye and horse-leg blocking, river rules, rook/cannon lines, soldier
direction, flying generals, self-check, checkmate/no-legal-move, and the selected
repetition policy. Render river, palaces, intersections, captures, selection,
legal targets, last move, check, sides, and local orientation.

## International chess

```ts
type ChessMove = {
  type: "chess.move";
  from: { file: number; rank: number };
  to: { file: number; rank: number };
  promotion?: "queen" | "rook" | "bishop" | "knight";
};
```

Map starter to white. Derive castling, en-passant, promotion, half-move clock, and
repetition keys from history. Cover movement, blockers, captures, self-check,
castling, en passant, promotion, checkmate, and any supported draw rule.

Before adopting a rule library, verify current ESM/browser support, TypeScript
types, license, deterministic history/FEN behavior, undo/replay, and bundle size.
Keep the kit-facing move schema app-owned.

Implement canonical coordinates, replay, ordinary moves, king/general safety,
terminal detection, special moves, plugin adapter, responsive board, then two-peer
undo/restart/reconnect/sync tests.
