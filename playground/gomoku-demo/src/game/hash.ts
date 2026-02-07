import type { GameState } from "./state";

const fnv1a = (input: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

export const hashState = (state: GameState) => {
  const boardStr = state.board.map((row) => row.join("")).join("|");
  const base = `${boardStr}:${state.turn}:${state.currentPlayer}:${state.winner}`;
  return fnv1a(base).toString(16);
};
