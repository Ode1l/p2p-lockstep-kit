import { describe, expect, it } from "vitest";
import {
  buildGomokuSnapshot,
  createGomokuSessionPlugin,
  createMove,
  GOMOKU_SIZE,
  type GomokuMove,
} from "./game.js";
import type { GameState } from "p2p-lockstep-kit-session";
import type { GomokuHistoryEntry } from "./game.js";

const entry = (
  turn: number,
  x: number,
  y: number,
  player: "local" | "remote" = turn % 2 === 1 ? "local" : "remote",
): GomokuHistoryEntry => ({
  turn,
  player,
  move: createMove({ x, y }),
});

const gameState = (history: GomokuHistoryEntry[]): GameState => ({
  history,
  localState: "turn",
  remoteState: "remote_turn",
  turn: history.length + 1,
  lastStart: "local",
});

describe("gomoku rules", () => {
  it("detects horizontal wins", () => {
    const history = [
      entry(1, 0, 0),
      entry(2, 0, 1),
      entry(3, 1, 0),
      entry(4, 1, 1),
      entry(5, 2, 0),
      entry(6, 2, 1),
      entry(7, 3, 0),
      entry(8, 3, 1),
      entry(9, 4, 0),
    ];

    expect(buildGomokuSnapshot(history).winner).toBe(1);
    expect(buildGomokuSnapshot(history).winningPlayer).toBe("local");
    expect(buildGomokuSnapshot(history).winningCells).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(createGomokuSessionPlugin().checkWin(gameState(history), history)).toBe("local");
  });

  it("detects vertical wins", () => {
    const history = [
      entry(1, 0, 0),
      entry(2, 1, 0),
      entry(3, 0, 1),
      entry(4, 1, 1),
      entry(5, 0, 2),
      entry(6, 1, 2),
      entry(7, 0, 3),
      entry(8, 1, 3),
      entry(9, 0, 4),
    ];

    expect(buildGomokuSnapshot(history).winner).toBe(1);
  });

  it("detects both diagonal directions", () => {
    const downRight = [
      entry(1, 0, 0),
      entry(2, 0, 1),
      entry(3, 1, 1),
      entry(4, 0, 2),
      entry(5, 2, 2),
      entry(6, 0, 3),
      entry(7, 3, 3),
      entry(8, 0, 4),
      entry(9, 4, 4),
    ];
    const upRight = [
      entry(1, 0, 4),
      entry(2, 0, 0),
      entry(3, 1, 3),
      entry(4, 1, 0),
      entry(5, 2, 2),
      entry(6, 2, 0),
      entry(7, 3, 1),
      entry(8, 3, 0),
      entry(9, 4, 0),
    ];

    expect(buildGomokuSnapshot(downRight).winner).toBe(1);
    expect(buildGomokuSnapshot(upRight).winner).toBe(1);
  });

  it("rejects invalid, out-of-range, and occupied moves", () => {
    const plugin = createGomokuSessionPlugin();
    const occupied = [entry(1, 7, 7)];

    expect(plugin.validateMove({ x: 1, y: 1 }, gameState([])).valid).toBe(false);
    expect(
      plugin.validateMove(
        { ...createMove({ x: 0, y: 0 }), x: GOMOKU_SIZE } satisfies GomokuMove,
        gameState([]),
      ).valid,
    ).toBe(false);
    expect(plugin.validateMove(createMove({ x: 7, y: 7 }), gameState(occupied))).toEqual({
      valid: false,
      reason: "Cell already occupied.",
    });
  });

  it("rejects moves after the board has a winner", () => {
    const plugin = createGomokuSessionPlugin();
    const won = [
      entry(1, 0, 0),
      entry(2, 0, 1),
      entry(3, 1, 0),
      entry(4, 1, 1),
      entry(5, 2, 0),
      entry(6, 2, 1),
      entry(7, 3, 0),
      entry(8, 3, 1),
      entry(9, 4, 0),
    ];

    expect(plugin.validateMove(createMove({ x: 8, y: 8 }), gameState(won))).toEqual({
      valid: false,
      reason: "Game already finished.",
    });
  });
});
