import type { Board } from "./state";

const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export const isWin = (
  board: Board,
  move: { x: number; y: number; player: 1 | 2 },
) => {
  const { x, y, player } = move;
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    let nx = x + dx;
    let ny = y + dy;
    while (
      nx >= 0 &&
      ny >= 0 &&
      ny < board.length &&
      nx < board[0].length &&
      board[ny][nx] === player
    ) {
      count += 1;
      nx += dx;
      ny += dy;
    }
    nx = x - dx;
    ny = y - dy;
    while (
      nx >= 0 &&
      ny >= 0 &&
      ny < board.length &&
      nx < board[0].length &&
      board[ny][nx] === player
    ) {
      count += 1;
      nx -= dx;
      ny -= dy;
    }
    if (count >= 5) {
      return true;
    }
  }
  return false;
};
