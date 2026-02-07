import { isWin } from "./rules";
import { hashState } from "./hash";

export type Cell = 0 | 1 | 2;
export type Board = Cell[][];

export type GameState = {
  board: Board;
  turn: number;
  currentPlayer: 1 | 2;
  winner: 0 | 1 | 2;
  lastMove?: { x: number; y: number; player: 1 | 2 };
  hash: string;
};

export type Move = { x: number; y: number; player: 1 | 2; turn: number };

export const BOARD_SIZE = 15;

export const createEmptyBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 0 as Cell),
  );

export const createInitialState = (): GameState => {
  const board = createEmptyBoard();
  const state: GameState = {
    board,
    turn: 1,
    currentPlayer: 1,
    winner: 0,
    hash: "",
  };
  state.hash = hashState(state);
  return state;
};

export const cloneState = (state: GameState): GameState => ({
  board: state.board.map((row) => row.slice()),
  turn: state.turn,
  currentPlayer: state.currentPlayer,
  winner: state.winner,
  lastMove: state.lastMove ? { ...state.lastMove } : undefined,
  hash: state.hash,
});

export const resetState = (state: GameState) => {
  state.board = createEmptyBoard();
  state.turn = 1;
  state.currentPlayer = 1;
  state.winner = 0;
  state.lastMove = undefined;
  state.hash = hashState(state);
};

export const canPlace = (state: GameState, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) {
    return false;
  }
  if (state.winner !== 0) {
    return false;
  }
  return state.board[y][x] === 0;
};

export const applyMove = (state: GameState, move: Move) => {
  const { x, y, player } = move;
  state.board[y][x] = player;
  state.lastMove = { x, y, player };
  if (isWin(state.board, move)) {
    state.winner = player;
  }
  if (state.winner === 0) {
    state.turn += 1;
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  }
  state.hash = hashState(state);
};

export const undoMove = (state: GameState, move: Move) => {
  const { x, y } = move;
  state.board[y][x] = 0;
  state.winner = 0;
  state.turn = Math.max(1, state.turn - 1);
  state.currentPlayer = move.player;
  state.lastMove = undefined;
  state.hash = hashState(state);
};
