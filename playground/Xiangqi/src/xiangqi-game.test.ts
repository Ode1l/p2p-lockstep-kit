import { describe, expect, it } from "vitest";
import type { GameState } from "p2p-lockstep-kit-session";
import {
  buildXiangqiSnapshot,
  createEmptyBoard,
  createInitialBoard,
  createXiangqiMove,
  createXiangqiSessionPlugin,
  deriveBoardStatus,
  isXiangqiMove,
  legalMovesFrom,
  playerForSide,
  validateMoveOnBoard,
  type XiangqiBoard,
  type XiangqiHistoryEntry,
  type XiangqiMove,
  type XiangqiPiece,
  type XiangqiPoint,
} from "./xiangqi-game.js";

const point = (file: number, rank: number): XiangqiPoint => ({ file, rank });
const move = (from: XiangqiPoint, to: XiangqiPoint): XiangqiMove =>
  createXiangqiMove(from, to);
const entry = (turn: number, from: XiangqiPoint, to: XiangqiPoint): XiangqiHistoryEntry => ({
  turn,
  player: turn % 2 === 1 ? "local" : "remote",
  move: move(from, to),
});
const state = (history: XiangqiHistoryEntry[], lastStart: "local" | "remote" = "local"): GameState => ({
  history,
  localState: "turn",
  remoteState: "remote_turn",
  turn: history.length + 1,
  lastStart,
});

const put = (board: XiangqiBoard, file: number, rank: number, piece: XiangqiPiece) => {
  board[rank]![file] = piece;
};

describe("xiangqi rules", () => {
  it("guards malformed and out-of-range payloads", () => {
    expect(isXiangqiMove({ type: "xiangqi.move", from: point(0, 0), to: point(0, 1) })).toBe(true);
    expect(isXiangqiMove({ type: "xiangqi.move", from: point(0, 0), to: { file: 9, rank: 1 } })).toBe(false);
    expect(isXiangqiMove({ type: "xiangqi.move", from: point(0, 0), to: point(0, 1), extra: "ok" })).toBe(true);
    expect(isXiangqiMove({ from: point(0, 0), to: point(0, 1) })).toBe(false);
  });

  it("starts from the canonical red-bottom position", () => {
    const snapshot = buildXiangqiSnapshot([]);

    expect(snapshot.valid).toBe(true);
    expect(snapshot.sideToMove).toBe("red");
    expect(snapshot.board[0]![4]).toMatchObject({ side: "red", type: "general" });
    expect(snapshot.board[9]![4]).toMatchObject({ side: "black", type: "general" });
    expect(snapshot.board[2]![1]).toMatchObject({ side: "red", type: "cannon" });
    expect(snapshot.board[6]![8]).toMatchObject({ side: "black", type: "soldier" });
  });

  it("replays captures deterministically from serialized history", () => {
    const history = [
      entry(1, point(0, 3), point(0, 4)),
      entry(2, point(0, 6), point(0, 5)),
      entry(3, point(0, 4), point(0, 5)),
    ];
    const first = buildXiangqiSnapshot(history);
    const second = buildXiangqiSnapshot(JSON.parse(JSON.stringify(history)));

    expect(first.valid).toBe(true);
    expect(first.board[5]![0]).toMatchObject({ side: "red", type: "soldier" });
    expect(first.captured).toEqual([{ side: "black", type: "soldier" }]);
    expect(first.positionKey).toBe(second.positionKey);
  });

  it("rejects opponent pieces, blockers, and invalid cannon screens", () => {
    const plugin = createXiangqiSessionPlugin();

    expect(plugin.validateMove(move(point(0, 6), point(0, 5)), state([])).valid).toBe(false);
    expect(plugin.validateMove(move(point(0, 0), point(0, 4)), state([])).valid).toBe(false);
    expect(plugin.validateMove(move(point(1, 2), point(1, 7)), state([])).valid).toBe(false);
    expect(plugin.validateMove(move(point(1, 2), point(1, 9)), state([])).valid).toBe(true);
  });

  it("enforces horse legs and elephant eyes, river, and palace bounds", () => {
    const board = createInitialBoard();

    expect(validateMoveOnBoard(board, "red", move(point(1, 0), point(3, 1))).valid).toBe(false);
    expect(validateMoveOnBoard(board, "red", move(point(1, 0), point(2, 2))).valid).toBe(true);
    expect(validateMoveOnBoard(board, "red", move(point(2, 0), point(4, 2))).valid).toBe(true);
    expect(validateMoveOnBoard(board, "red", move(point(3, 0), point(4, 1))).valid).toBe(true);
    expect(validateMoveOnBoard(board, "red", move(point(4, 0), point(4, 1))).valid).toBe(true);
    expect(validateMoveOnBoard(board, "red", move(point(4, 0), point(4, 2))).valid).toBe(false);

    const riverBoard = createEmptyBoard();
    put(riverBoard, 4, 0, { side: "red", type: "general" });
    put(riverBoard, 4, 9, { side: "black", type: "general" });
    put(riverBoard, 4, 3, { side: "red", type: "soldier" });
    put(riverBoard, 6, 4, { side: "red", type: "elephant" });
    expect(validateMoveOnBoard(riverBoard, "red", move(point(6, 4), point(8, 6))).valid).toBe(false);
  });

  it("allows soldiers to move sideways only after crossing the river", () => {
    const plugin = createXiangqiSessionPlugin();
    expect(plugin.validateMove(move(point(0, 3), point(1, 3)), state([])).valid).toBe(false);
    expect(plugin.validateMove(move(point(0, 3), point(0, 4)), state([])).valid).toBe(true);

    const crossed = [
      entry(1, point(0, 3), point(0, 4)),
      entry(2, point(8, 6), point(8, 5)),
      entry(3, point(0, 4), point(0, 5)),
      entry(4, point(6, 6), point(6, 5)),
    ];

    expect(plugin.validateMove(move(point(0, 5), point(1, 5)), state(crossed)).valid).toBe(true);
    expect(plugin.validateMove(move(point(0, 5), point(0, 4)), state(crossed)).valid).toBe(false);
  });

  it("rejects flying generals and moves that expose the own general", () => {
    const board = createEmptyBoard();
    put(board, 4, 0, { side: "red", type: "general" });
    put(board, 4, 9, { side: "black", type: "general" });
    put(board, 4, 1, { side: "red", type: "rook" });

    expect(validateMoveOnBoard(board, "red", move(point(4, 1), point(3, 1)))).toEqual({
      valid: false,
      reason: "Move leaves the general in check.",
    });
  });

  it("detects no-legal-move losses and maps winners through the starter", () => {
    const board = createEmptyBoard();
    put(board, 4, 0, { side: "red", type: "general" });
    put(board, 3, 0, { side: "red", type: "rook" });
    put(board, 5, 0, { side: "red", type: "rook" });
    put(board, 4, 8, { side: "red", type: "rook" });
    put(board, 4, 9, { side: "black", type: "general" });

    expect(deriveBoardStatus(board, "black")).toEqual({
      check: true,
      noLegalMoves: true,
      winner: "red",
    });
    expect(playerForSide("red", "remote")).toBe("remote");
    expect(playerForSide("black", "remote")).toBe("local");
  });

  it("returns legal destinations from the replayed current position", () => {
    const destinations = legalMovesFrom([], point(1, 0)).map((candidate) => candidate.to);

    expect(destinations).toContainEqual(point(0, 2));
    expect(destinations).toContainEqual(point(2, 2));
    expect(destinations).not.toContainEqual(point(3, 1));
  });
});
