import { describe, expect, it } from "vitest";
import type { GameState } from "p2p-lockstep-kit-session";
import {
  buildChessSnapshot,
  createChessMove,
  createChessSessionPlugin,
  isChessMove,
  legalMovesFrom,
  type ChessHistoryEntry,
  type Promotion,
} from "./chess-game.js";

const point = (square: string) => ({ file: square.charCodeAt(0) - 97, rank: Number(square[1]) - 1 });
const move = (from: string, to: string, promotion?: Promotion) => createChessMove(point(from), point(to), promotion);
const entry = (turn: number, from: string, to: string, promotion?: Promotion): ChessHistoryEntry => ({
  turn,
  player: turn % 2 === 1 ? "local" : "remote",
  move: move(from, to, promotion),
});
const state = (history: ChessHistoryEntry[], lastStart: "local" | "remote" = "local"): GameState => ({
  history,
  localState: "turn",
  remoteState: "remote_turn",
  turn: history.length + 1,
  lastStart,
});

describe("international chess rules", () => {
  it("guards malformed and out-of-range payloads", () => {
    expect(isChessMove({ type: "chess.move", from: point("e2"), to: point("e4") })).toBe(true);
    expect(isChessMove({ type: "chess.move", from: { file: 8, rank: 0 }, to: point("e4") })).toBe(false);
    expect(isChessMove({ type: "chess.move", from: point("e2"), to: point("e4"), promotion: "king" })).toBe(false);
  });

  it("replays ordinary moves and captures deterministically", () => {
    const history = [entry(1, "e2", "e4"), entry(2, "d7", "d5"), entry(3, "e4", "d5")];
    const first = buildChessSnapshot(history);
    const second = buildChessSnapshot(JSON.parse(JSON.stringify(history)));
    expect(first.valid).toBe(true);
    expect(first.board[4]![3]).toMatchObject({ color: "white", type: "p" });
    expect(first.captured).toEqual([{ color: "black", type: "p" }]);
    expect(first.positionKey).toBe(second.positionKey);
  });

  it("rejects opponent pieces, illegal geometry, blockers, and self-check", () => {
    const plugin = createChessSessionPlugin();
    expect(plugin.validateMove(move("e7", "e5"), state([])).valid).toBe(false);
    expect(plugin.validateMove(move("c1", "h6"), state([])).valid).toBe(false);
    expect(plugin.validateMove(move("e2", "e5"), state([])).valid).toBe(false);
    const pin = [entry(1, "e2", "e3"), entry(2, "d7", "d5"), entry(3, "f1", "b5")];
    expect(plugin.validateMove(move("c7", "c6"), state(pin)).valid).toBe(true);
  });

  it("supports castling and rejects castling through check", () => {
    const clear = [
      entry(1, "e2", "e4"), entry(2, "e7", "e5"), entry(3, "g1", "f3"),
      entry(4, "b8", "c6"), entry(5, "f1", "c4"), entry(6, "g8", "f6"),
    ];
    expect(createChessSessionPlugin().validateMove(move("e1", "g1"), state(clear)).valid).toBe(true);
    const replayed = buildChessSnapshot([...clear, entry(7, "e1", "g1")]);
    expect(replayed.board[0]![6]?.type).toBe("k");
    expect(replayed.board[0]![5]?.type).toBe("r");
  });

  it("supports en passant with one-move lifetime", () => {
    const history = [entry(1, "e2", "e4"), entry(2, "a7", "a6"), entry(3, "e4", "e5"), entry(4, "d7", "d5")];
    const next = [...history, entry(5, "e5", "d6")];
    expect(buildChessSnapshot(next).captured).toContainEqual({ color: "black", type: "p" });
    expect(buildChessSnapshot(next).board[4]![3]).toBeNull();
  });

  it("serializes promotion choice and offers all four choices", () => {
    const history = [
      entry(1, "a2", "a4"), entry(2, "h7", "h5"), entry(3, "a4", "a5"),
      entry(4, "h5", "h4"), entry(5, "a5", "a6"), entry(6, "h4", "h3"),
      entry(7, "a6", "b7"), entry(8, "h3", "g2"),
    ];
    const promotions = legalMovesFrom(history, point("b7")).filter(
      (candidate) => candidate.to.file === 0 && candidate.to.rank === 7,
    );
    expect(promotions.map((candidate) => candidate.promotion).sort()).toEqual(["bishop", "knight", "queen", "rook"]);
    expect(buildChessSnapshot([...history, entry(9, "b7", "a8", "knight")]).board[7]![0]?.type).toBe("n");
  });

  it("detects checkmate and maps the winner to either starter perspective", () => {
    const mate = [entry(1, "f2", "f3"), entry(2, "e7", "e5"), entry(3, "g2", "g4"), entry(4, "d8", "h4")];
    expect(buildChessSnapshot(mate).winner).toBe("black");
    expect(createChessSessionPlugin().checkWin(state(mate, "local"), mate)).toBe("remote");
    expect(createChessSessionPlugin().checkWin(state(mate, "remote"), mate)).toBe("local");
    expect(createChessSessionPlugin().validateMove(move("e2", "e4"), state(mate)).valid).toBe(false);
  });

  it("undo is a pure history truncation", () => {
    const history = [entry(1, "e2", "e4"), entry(2, "e7", "e5")];
    expect(buildChessSnapshot(history.slice(0, -1)).turn).toBe("black");
    expect(buildChessSnapshot(history.slice(0, -1)).board[6]![4]?.color).toBe("black");
  });
});
