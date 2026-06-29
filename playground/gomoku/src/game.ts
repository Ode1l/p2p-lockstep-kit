import type {
  GameState,
  IGamePlugin,
  PlayerLabel,
  TurnEntry,
} from "p2p-lockstep-kit-session";

export const GOMOKU_SIZE = 15;
export const GOMOKU_MOVE_TYPE = "gomoku.move";

export type Stone = 0 | 1 | 2;
export type Board = Stone[][];
export type PlayerStone = 1 | 2;
export type Cell = { x: number; y: number };
export type GomokuMove = Cell & {
  type: typeof GOMOKU_MOVE_TYPE;
};
export type GomokuHistoryEntry = TurnEntry;

export type GomokuSnapshot = {
  board: Board;
  winner: PlayerStone | null;
  winningPlayer: PlayerLabel | null;
  winningCells: Cell[];
  lastMove: (Cell & { stone: PlayerStone; owner: PlayerLabel }) | null;
  nextStone: PlayerStone;
};

const directions: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export const createEmptyBoard = (): Board =>
  Array.from({ length: GOMOKU_SIZE }, () =>
    Array.from({ length: GOMOKU_SIZE }, () => 0 as Stone),
  );

export const createMove = (cell: Cell): GomokuMove => ({
  type: GOMOKU_MOVE_TYPE,
  x: cell.x,
  y: cell.y,
});

export const isGomokuMove = (value: unknown): value is GomokuMove => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const move = value as Partial<GomokuMove>;
  return (
    move.type === GOMOKU_MOVE_TYPE &&
    Number.isInteger(move.x) &&
    Number.isInteger(move.y) &&
    typeof move.x === "number" &&
    typeof move.y === "number" &&
    move.x >= 0 &&
    move.y >= 0 &&
    move.x < GOMOKU_SIZE &&
    move.y < GOMOKU_SIZE
  );
};

export const stoneForTurn = (turn: number): PlayerStone =>
  turn % 2 === 1 ? 1 : 2;

export const isWin = (board: Board, move: Cell & { stone: PlayerStone }) => {
  return findWinningCells(board, move).length > 0;
};

export const findWinningCells = (
  board: Board,
  move: Cell & { stone: PlayerStone },
): Cell[] => {
  for (const [dx, dy] of directions) {
    const backward = collectDirection(board, move, -dx, -dy).reverse();
    const forward = collectDirection(board, move, dx, dy);
    const line = [...backward, { x: move.x, y: move.y }, ...forward];

    if (line.length >= 5) {
      const moveIndex = backward.length;
      const start = Math.min(Math.max(0, moveIndex - 4), line.length - 5);
      return line.slice(start, start + 5);
    }
  }
  return [];
};

const collectDirection = (
  board: Board,
  move: Cell & { stone: PlayerStone },
  dx: number,
  dy: number,
) => {
  const cells: Cell[] = [];
  let x = move.x + dx;
  let y = move.y + dy;

  while (
    x >= 0 &&
    y >= 0 &&
    x < GOMOKU_SIZE &&
    y < GOMOKU_SIZE &&
    board[y][x] === move.stone
  ) {
    cells.push({ x, y });
    x += dx;
    y += dy;
  }

  return cells;
};

export const buildGomokuSnapshot = (
  history: readonly GomokuHistoryEntry[],
): GomokuSnapshot => {
  const board = createEmptyBoard();
  let winner: PlayerStone | null = null;
  let winningPlayer: PlayerLabel | null = null;
  let winningCells: Cell[] = [];
  let lastMove: GomokuSnapshot["lastMove"] = null;

  for (const entry of history) {
    if (!isGomokuMove(entry.move)) {
      continue;
    }

    const stone = stoneForTurn(entry.turn);
    if (board[entry.move.y][entry.move.x] !== 0) {
      continue;
    }

    board[entry.move.y][entry.move.x] = stone;
    lastMove = {
      x: entry.move.x,
      y: entry.move.y,
      stone,
      owner: entry.player,
    };

    const cells = findWinningCells(board, { ...entry.move, stone });
    if (!winner && cells.length > 0) {
      winner = stone;
      winningPlayer = entry.player;
      winningCells = cells;
    }
  }

  return {
    board,
    winner,
    winningPlayer,
    winningCells,
    lastMove,
    nextStone: stoneForTurn(history.length + 1),
  };
};

const canPlaceFromHistory = (
  history: readonly GomokuHistoryEntry[],
  move: GomokuMove,
) => {
  const snapshot = buildGomokuSnapshot(history);
  if (snapshot.winner) {
    return { valid: false, reason: "Game already finished." };
  }
  if (snapshot.board[move.y][move.x] !== 0) {
    return { valid: false, reason: "Cell already occupied." };
  }
  return { valid: true };
};

export const createGomokuSessionPlugin = (): IGamePlugin => ({
  validateMove(move: unknown, gameState: GameState) {
    if (!isGomokuMove(move)) {
      return { valid: false, reason: "Invalid gomoku move." };
    }
    return canPlaceFromHistory(gameState.history, move);
  },
  checkWin(_gameState: GameState, history) {
    return buildGomokuSnapshot(history).winningPlayer;
  },
});
