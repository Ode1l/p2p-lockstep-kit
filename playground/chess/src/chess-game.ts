import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import type {
  GameState,
  IGamePlugin,
  PlayerLabel,
  TurnEntry,
} from "p2p-lockstep-kit-session";

export const CHESS_MOVE_TYPE = "chess.move";

export type ChessColor = "white" | "black";
export type Promotion = "queen" | "rook" | "bishop" | "knight";
export type ChessPoint = { file: number; rank: number };
export type ChessMove = {
  type: typeof CHESS_MOVE_TYPE;
  from: ChessPoint;
  to: ChessPoint;
  promotion?: Promotion;
};
export type BoardPiece = { color: ChessColor; type: PieceSymbol };
export type CapturedPiece = BoardPiece;
export type ChessHistoryEntry = TurnEntry;

export type ChessSnapshot = {
  board: Array<Array<BoardPiece | null>>;
  captured: CapturedPiece[];
  turn: ChessColor;
  check: boolean;
  checkmate: boolean;
  stalemate: boolean;
  winner: ChessColor | null;
  lastMove: ChessMove | null;
  positionKey: string;
  valid: boolean;
  error: string | null;
};

const promotionToSymbol: Record<Promotion, "q" | "r" | "b" | "n"> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};

const symbolToPromotion: Record<"q" | "r" | "b" | "n", Promotion> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPoint = (value: unknown): value is ChessPoint =>
  isRecord(value) &&
  typeof value.file === "number" &&
  typeof value.rank === "number" &&
  Number.isInteger(value.file) &&
  Number.isInteger(value.rank) &&
  value.file >= 0 &&
  value.file < 8 &&
  value.rank >= 0 &&
  value.rank < 8;

export const isChessMove = (value: unknown): value is ChessMove => {
  if (!isRecord(value) || value.type !== CHESS_MOVE_TYPE) return false;
  if (!isPoint(value.from) || !isPoint(value.to)) return false;
  if (!("promotion" in value) || value.promotion === undefined) return true;
  return (
    value.promotion === "queen" ||
    value.promotion === "rook" ||
    value.promotion === "bishop" ||
    value.promotion === "knight"
  );
};

export const createChessMove = (
  from: ChessPoint,
  to: ChessPoint,
  promotion?: Promotion,
): ChessMove => ({
  type: CHESS_MOVE_TYPE,
  from: { ...from },
  to: { ...to },
  ...(promotion ? { promotion } : {}),
});

export const pointToSquare = ({ file, rank }: ChessPoint): Square =>
  `${String.fromCharCode(97 + file)}${rank + 1}` as Square;

export const squareToPoint = (square: Square): ChessPoint => ({
  file: square.charCodeAt(0) - 97,
  rank: Number(square[1]) - 1,
});

export const colorForTurn = (turn: number): ChessColor =>
  turn % 2 === 1 ? "white" : "black";

export const colorForPlayer = (
  player: PlayerLabel,
  lastStart: PlayerLabel | null,
): ChessColor | null => {
  if (!lastStart) return null;
  return player === lastStart ? "white" : "black";
};

export const playerForColor = (
  color: ChessColor,
  lastStart: PlayerLabel | null,
): PlayerLabel | null => {
  if (!lastStart) return null;
  return color === "white"
    ? lastStart
    : lastStart === "local"
      ? "remote"
      : "local";
};

const fromJsColor = (color: Color): ChessColor =>
  color === "w" ? "white" : "black";

const toJsMove = (move: ChessMove) => ({
  from: pointToSquare(move.from),
  to: pointToSquare(move.to),
  ...(move.promotion ? { promotion: promotionToSymbol[move.promotion] } : {}),
});

const emptyBoard = (): ChessSnapshot["board"] =>
  Array.from({ length: 8 }, () => Array<BoardPiece | null>(8).fill(null));

const snapshotFromChess = (
  chess: Chess,
  captured: CapturedPiece[],
  lastMove: ChessMove | null,
  valid = true,
  error: string | null = null,
): ChessSnapshot => {
  const board = emptyBoard();
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const point = squareToPoint(piece.square);
      board[point.rank]![point.file] = {
        color: fromJsColor(piece.color),
        type: piece.type,
      };
    }
  }
  const checkmate = chess.isCheckmate();
  const turn = fromJsColor(chess.turn());
  return {
    board,
    captured,
    turn,
    check: chess.inCheck(),
    checkmate,
    stalemate: chess.isStalemate(),
    winner: checkmate ? (turn === "white" ? "black" : "white") : null,
    lastMove,
    positionKey: chess.fen(),
    valid,
    error,
  };
};

export const replayChess = (history: readonly ChessHistoryEntry[]) => {
  const chess = new Chess();
  const captured: CapturedPiece[] = [];
  let lastMove: ChessMove | null = null;

  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index]!;
    if (!isChessMove(entry.move)) {
      return {
        chess,
        snapshot: snapshotFromChess(
          chess,
          captured,
          lastMove,
          false,
          `Invalid move payload at turn ${entry.turn}.`,
        ),
      };
    }
    if (entry.turn !== index + 1 || colorForTurn(entry.turn) !== fromJsColor(chess.turn())) {
      return {
        chess,
        snapshot: snapshotFromChess(
          chess,
          captured,
          lastMove,
          false,
          `Invalid turn ordering at turn ${entry.turn}.`,
        ),
      };
    }

    try {
      const result = chess.move(toJsMove(entry.move));
      if (result.captured) {
        captured.push({
          color: result.color === "w" ? "black" : "white",
          type: result.captured,
        });
      }
      lastMove = entry.move;
    } catch {
      return {
        chess,
        snapshot: snapshotFromChess(
          chess,
          captured,
          lastMove,
          false,
          `Illegal move at turn ${entry.turn}.`,
        ),
      };
    }
  }

  return { chess, snapshot: snapshotFromChess(chess, captured, lastMove) };
};

export const buildChessSnapshot = (
  history: readonly ChessHistoryEntry[],
): ChessSnapshot => replayChess(history).snapshot;

export const legalMovesFrom = (
  history: readonly ChessHistoryEntry[],
  from: ChessPoint,
): ChessMove[] => {
  const { chess, snapshot } = replayChess(history);
  if (!snapshot.valid || snapshot.checkmate) return [];
  return chess
    .moves({ square: pointToSquare(from), verbose: true })
    .map((move) =>
      createChessMove(
        squareToPoint(move.from),
        squareToPoint(move.to),
        move.promotion ? symbolToPromotion[move.promotion as "q" | "r" | "b" | "n"] : undefined,
      ),
    );
};

const validateAgainstHistory = (
  history: readonly ChessHistoryEntry[],
  move: ChessMove,
) => {
  const { chess, snapshot } = replayChess(history);
  if (!snapshot.valid) return { valid: false, reason: snapshot.error ?? "Invalid history." };
  if (snapshot.checkmate) return { valid: false, reason: "Game already finished." };
  try {
    chess.move(toJsMove(move));
    return { valid: true };
  } catch {
    return { valid: false, reason: "Illegal chess move." };
  }
};

export const createChessSessionPlugin = (): IGamePlugin => ({
  validateMove(move: unknown, gameState: GameState) {
    if (!isChessMove(move)) return { valid: false, reason: "Invalid chess move." };
    return validateAgainstHistory(gameState.history, move);
  },
  checkWin(gameState, history) {
    const winner = buildChessSnapshot(history).winner;
    return winner ? playerForColor(winner, gameState.lastStart) : null;
  },
});
