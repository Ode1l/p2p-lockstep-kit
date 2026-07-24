import type {
  GameState,
  IGamePlugin,
  PlayerLabel,
  TurnEntry,
} from "p2p-lockstep-kit-session";

export const XIANGQI_FILES = 9;
export const XIANGQI_RANKS = 10;
export const XIANGQI_MOVE_TYPE = "xiangqi.move";

export type XiangqiSide = "red" | "black";
export type XiangqiPieceType =
  | "general"
  | "advisor"
  | "elephant"
  | "horse"
  | "rook"
  | "cannon"
  | "soldier";
export type XiangqiPoint = { file: number; rank: number };
export type XiangqiMove = {
  type: typeof XIANGQI_MOVE_TYPE;
  from: XiangqiPoint;
  to: XiangqiPoint;
};
export type XiangqiPiece = { side: XiangqiSide; type: XiangqiPieceType };
export type XiangqiBoard = Array<Array<XiangqiPiece | null>>;
export type XiangqiHistoryEntry = TurnEntry;
export type CapturedPiece = XiangqiPiece;

export type XiangqiSnapshot = {
  board: XiangqiBoard;
  captured: CapturedPiece[];
  sideToMove: XiangqiSide;
  check: boolean;
  winner: XiangqiSide | null;
  noLegalMoves: boolean;
  lastMove: XiangqiMove | null;
  positionKey: string;
  valid: boolean;
  error: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPoint = (value: unknown): value is XiangqiPoint =>
  isRecord(value) &&
  typeof value.file === "number" &&
  typeof value.rank === "number" &&
  Number.isInteger(value.file) &&
  Number.isInteger(value.rank) &&
  value.file >= 0 &&
  value.file < XIANGQI_FILES &&
  value.rank >= 0 &&
  value.rank < XIANGQI_RANKS;

export const isXiangqiMove = (value: unknown): value is XiangqiMove =>
  isRecord(value) &&
  value.type === XIANGQI_MOVE_TYPE &&
  isPoint(value.from) &&
  isPoint(value.to);

export const createXiangqiMove = (
  from: XiangqiPoint,
  to: XiangqiPoint,
): XiangqiMove => ({
  type: XIANGQI_MOVE_TYPE,
  from: { ...from },
  to: { ...to },
});

export const sideForTurn = (turn: number): XiangqiSide =>
  turn % 2 === 1 ? "red" : "black";

export const sideForPlayer = (
  player: PlayerLabel,
  lastStart: PlayerLabel | null,
): XiangqiSide | null => {
  if (!lastStart) return null;
  return player === lastStart ? "red" : "black";
};

export const playerForSide = (
  side: XiangqiSide,
  lastStart: PlayerLabel | null,
): PlayerLabel | null => {
  if (!lastStart) return null;
  return side === "red" ? lastStart : lastStart === "local" ? "remote" : "local";
};

const opposite = (side: XiangqiSide): XiangqiSide => (side === "red" ? "black" : "red");

const cloneBoard = (board: XiangqiBoard): XiangqiBoard =>
  board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));

export const createEmptyBoard = (): XiangqiBoard =>
  Array.from({ length: XIANGQI_RANKS }, () =>
    Array<XiangqiPiece | null>(XIANGQI_FILES).fill(null),
  );

const setPiece = (
  board: XiangqiBoard,
  file: number,
  rank: number,
  piece: XiangqiPiece,
) => {
  board[rank]![file] = piece;
};

export const createInitialBoard = (): XiangqiBoard => {
  const board = createEmptyBoard();
  const backRank: XiangqiPieceType[] = [
    "rook",
    "horse",
    "elephant",
    "advisor",
    "general",
    "advisor",
    "elephant",
    "horse",
    "rook",
  ];

  for (let file = 0; file < XIANGQI_FILES; file += 1) {
    setPiece(board, file, 0, { side: "red", type: backRank[file]! });
    setPiece(board, file, 9, { side: "black", type: backRank[file]! });
  }

  setPiece(board, 1, 2, { side: "red", type: "cannon" });
  setPiece(board, 7, 2, { side: "red", type: "cannon" });
  setPiece(board, 1, 7, { side: "black", type: "cannon" });
  setPiece(board, 7, 7, { side: "black", type: "cannon" });

  for (const file of [0, 2, 4, 6, 8]) {
    setPiece(board, file, 3, { side: "red", type: "soldier" });
    setPiece(board, file, 6, { side: "black", type: "soldier" });
  }

  return board;
};

const inBounds = ({ file, rank }: XiangqiPoint) =>
  file >= 0 && file < XIANGQI_FILES && rank >= 0 && rank < XIANGQI_RANKS;

const samePoint = (a: XiangqiPoint, b: XiangqiPoint) =>
  a.file === b.file && a.rank === b.rank;

const getPiece = (board: XiangqiBoard, point: XiangqiPoint): XiangqiPiece | null =>
  board[point.rank]?.[point.file] ?? null;

const isInPalace = (point: XiangqiPoint, side: XiangqiSide) => {
  if (point.file < 3 || point.file > 5) return false;
  return side === "red" ? point.rank >= 0 && point.rank <= 2 : point.rank >= 7 && point.rank <= 9;
};

const isOnOwnRiverSide = (point: XiangqiPoint, side: XiangqiSide) =>
  side === "red" ? point.rank <= 4 : point.rank >= 5;

const hasSoldierCrossed = (point: XiangqiPoint, side: XiangqiSide) =>
  side === "red" ? point.rank >= 5 : point.rank <= 4;

const forwardStep = (side: XiangqiSide) => (side === "red" ? 1 : -1);

const countBetween = (board: XiangqiBoard, from: XiangqiPoint, to: XiangqiPoint) => {
  if (from.file !== to.file && from.rank !== to.rank) return -1;
  const stepFile = Math.sign(to.file - from.file);
  const stepRank = Math.sign(to.rank - from.rank);
  let file = from.file + stepFile;
  let rank = from.rank + stepRank;
  let count = 0;

  while (file !== to.file || rank !== to.rank) {
    if (board[rank]![file]) count += 1;
    file += stepFile;
    rank += stepRank;
  }

  return count;
};

const canPieceMoveByShape = (
  board: XiangqiBoard,
  piece: XiangqiPiece,
  from: XiangqiPoint,
  to: XiangqiPoint,
  target: XiangqiPiece | null,
) => {
  const dx = to.file - from.file;
  const dy = to.rank - from.rank;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  switch (piece.type) {
    case "general":
      return absX + absY === 1 && isInPalace(to, piece.side);
    case "advisor":
      return absX === 1 && absY === 1 && isInPalace(to, piece.side);
    case "elephant": {
      if (absX !== 2 || absY !== 2 || !isOnOwnRiverSide(to, piece.side)) return false;
      return !board[from.rank + dy / 2]![from.file + dx / 2];
    }
    case "horse": {
      if (!((absX === 1 && absY === 2) || (absX === 2 && absY === 1))) return false;
      const leg =
        absY === 2
          ? { file: from.file, rank: from.rank + Math.sign(dy) }
          : { file: from.file + Math.sign(dx), rank: from.rank };
      return !getPiece(board, leg);
    }
    case "rook":
      return (dx === 0 || dy === 0) && countBetween(board, from, to) === 0;
    case "cannon": {
      if (dx !== 0 && dy !== 0) return false;
      const blockers = countBetween(board, from, to);
      return target ? blockers === 1 : blockers === 0;
    }
    case "soldier":
      if (dx === 0 && dy === forwardStep(piece.side)) return true;
      return hasSoldierCrossed(from, piece.side) && absX === 1 && dy === 0;
  }
};

const findGeneral = (board: XiangqiBoard, side: XiangqiSide): XiangqiPoint | null => {
  for (let rank = 0; rank < XIANGQI_RANKS; rank += 1) {
    for (let file = 0; file < XIANGQI_FILES; file += 1) {
      const piece = board[rank]![file];
      if (piece?.side === side && piece.type === "general") return { file, rank };
    }
  }
  return null;
};

const generalsFace = (board: XiangqiBoard) => {
  const red = findGeneral(board, "red");
  const black = findGeneral(board, "black");
  if (!red || !black || red.file !== black.file) return false;
  return countBetween(board, red, black) === 0;
};

const canPieceAttackPoint = (
  board: XiangqiBoard,
  piece: XiangqiPiece,
  from: XiangqiPoint,
  target: XiangqiPoint,
) => {
  if (piece.type === "general" && from.file === target.file) {
    return countBetween(board, from, target) === 0;
  }
  return canPieceMoveByShape(board, piece, from, target, getPiece(board, target));
};

export const isGeneralInCheck = (board: XiangqiBoard, side: XiangqiSide) => {
  const general = findGeneral(board, side);
  if (!general) return true;
  const attacker = opposite(side);

  for (let rank = 0; rank < XIANGQI_RANKS; rank += 1) {
    for (let file = 0; file < XIANGQI_FILES; file += 1) {
      const piece = board[rank]![file];
      if (piece?.side !== attacker) continue;
      if (canPieceAttackPoint(board, piece, { file, rank }, general)) return true;
    }
  }

  return false;
};

const applyMoveToBoard = (board: XiangqiBoard, move: XiangqiMove) => {
  const next = cloneBoard(board);
  const piece = getPiece(next, move.from);
  const captured = getPiece(next, move.to);
  next[move.to.rank]![move.to.file] = piece ? { ...piece } : null;
  next[move.from.rank]![move.from.file] = null;
  return { board: next, captured };
};

export const validateMoveOnBoard = (
  board: XiangqiBoard,
  side: XiangqiSide,
  move: XiangqiMove,
) => {
  if (!inBounds(move.from) || !inBounds(move.to) || samePoint(move.from, move.to)) {
    return { valid: false, reason: "Move is out of range." };
  }

  const piece = getPiece(board, move.from);
  const target = getPiece(board, move.to);
  if (!piece) return { valid: false, reason: "No piece at the source point." };
  if (piece.side !== side) return { valid: false, reason: "Cannot move the opponent's piece." };
  if (target?.side === side) return { valid: false, reason: "Cannot capture your own piece." };
  if (target?.type === "general") return { valid: false, reason: "The general is not captured directly." };
  if (!canPieceMoveByShape(board, piece, move.from, move.to, target)) {
    return { valid: false, reason: "Illegal Xiangqi move." };
  }

  const next = applyMoveToBoard(board, move).board;
  if (generalsFace(next) || isGeneralInCheck(next, side)) {
    return { valid: false, reason: "Move leaves the general in check." };
  }

  return { valid: true };
};

export const legalMovesForPiece = (
  board: XiangqiBoard,
  side: XiangqiSide,
  from: XiangqiPoint,
): XiangqiMove[] => {
  const piece = getPiece(board, from);
  if (piece?.side !== side) return [];
  const moves: XiangqiMove[] = [];

  for (let rank = 0; rank < XIANGQI_RANKS; rank += 1) {
    for (let file = 0; file < XIANGQI_FILES; file += 1) {
      const move = createXiangqiMove(from, { file, rank });
      if (validateMoveOnBoard(board, side, move).valid) moves.push(move);
    }
  }

  return moves;
};

const hasAnyLegalMove = (board: XiangqiBoard, side: XiangqiSide) => {
  for (let rank = 0; rank < XIANGQI_RANKS; rank += 1) {
    for (let file = 0; file < XIANGQI_FILES; file += 1) {
      if (legalMovesForPiece(board, side, { file, rank }).length > 0) return true;
    }
  }
  return false;
};

export const deriveBoardStatus = (board: XiangqiBoard, sideToMove: XiangqiSide) => {
  const check = isGeneralInCheck(board, sideToMove);
  const noLegalMoves = !hasAnyLegalMove(board, sideToMove);
  return {
    check,
    noLegalMoves,
    winner: noLegalMoves ? opposite(sideToMove) : null,
  };
};

const boardKey = (board: XiangqiBoard, sideToMove: XiangqiSide) => {
  const pieces: string[] = [];
  for (let rank = 0; rank < XIANGQI_RANKS; rank += 1) {
    for (let file = 0; file < XIANGQI_FILES; file += 1) {
      const piece = board[rank]![file];
      if (piece) pieces.push(`${piece.side[0]}${piece.type[0]}${file}${rank}`);
    }
  }
  return `${sideToMove}:${pieces.join("|")}`;
};

const snapshotFromBoard = (
  board: XiangqiBoard,
  captured: CapturedPiece[],
  lastMove: XiangqiMove | null,
  sideToMove: XiangqiSide,
  valid = true,
  error: string | null = null,
): XiangqiSnapshot => {
  const status = valid
    ? deriveBoardStatus(board, sideToMove)
    : { check: false, noLegalMoves: false, winner: null };
  return {
    board,
    captured,
    sideToMove,
    check: status.check,
    winner: status.winner,
    noLegalMoves: status.noLegalMoves,
    lastMove,
    positionKey: boardKey(board, sideToMove),
    valid,
    error,
  };
};

export const buildXiangqiSnapshot = (
  history: readonly XiangqiHistoryEntry[],
): XiangqiSnapshot => {
  let board = createInitialBoard();
  const captured: CapturedPiece[] = [];
  let lastMove: XiangqiMove | null = null;

  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index]!;
    const sideToMove = sideForTurn(index + 1);

    if (entry.turn !== index + 1) {
      return snapshotFromBoard(
        board,
        captured,
        lastMove,
        sideToMove,
        false,
        `Invalid turn ordering at turn ${entry.turn}.`,
      );
    }
    if (!isXiangqiMove(entry.move)) {
      return snapshotFromBoard(
        board,
        captured,
        lastMove,
        sideToMove,
        false,
        `Invalid move payload at turn ${entry.turn}.`,
      );
    }

    const current = snapshotFromBoard(board, captured, lastMove, sideToMove);
    if (current.winner) {
      return snapshotFromBoard(
        board,
        captured,
        lastMove,
        sideToMove,
        false,
        `Game already finished before turn ${entry.turn}.`,
      );
    }

    const validation = validateMoveOnBoard(board, sideToMove, entry.move);
    if (!validation.valid) {
      return snapshotFromBoard(
        board,
        captured,
        lastMove,
        sideToMove,
        false,
        validation.reason ?? `Illegal move at turn ${entry.turn}.`,
      );
    }

    const applied = applyMoveToBoard(board, entry.move);
    board = applied.board;
    if (applied.captured) captured.push(applied.captured);
    lastMove = entry.move;
  }

  return snapshotFromBoard(board, captured, lastMove, sideForTurn(history.length + 1));
};

export const legalMovesFrom = (
  history: readonly XiangqiHistoryEntry[],
  from: XiangqiPoint,
): XiangqiMove[] => {
  const snapshot = buildXiangqiSnapshot(history);
  if (!snapshot.valid || snapshot.winner) return [];
  return legalMovesForPiece(snapshot.board, snapshot.sideToMove, from);
};

const validateAgainstHistory = (
  history: readonly XiangqiHistoryEntry[],
  move: XiangqiMove,
) => {
  const snapshot = buildXiangqiSnapshot(history);
  if (!snapshot.valid) return { valid: false, reason: snapshot.error ?? "Invalid history." };
  if (snapshot.winner) return { valid: false, reason: "Game already finished." };
  return validateMoveOnBoard(snapshot.board, snapshot.sideToMove, move);
};

export const createXiangqiSessionPlugin = (): IGamePlugin => ({
  validateMove(move: unknown, gameState: GameState) {
    if (!isXiangqiMove(move)) return { valid: false, reason: "Invalid Xiangqi move." };
    return validateAgainstHistory(gameState.history, move);
  },
  checkWin(gameState, history) {
    const winner = buildXiangqiSnapshot(history).winner;
    return winner ? playerForSide(winner, gameState.lastStart) : null;
  },
});
