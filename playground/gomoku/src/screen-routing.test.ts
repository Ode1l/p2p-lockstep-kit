import { describe, expect, it } from "vitest";
import type { GameStateSnapshot } from "p2p-lockstep-kit-session";
import { shouldShowPairingScreen } from "./screen-routing.js";

const idleSnapshot: GameStateSnapshot = {
  localState: "idle",
  remoteState: "idle",
  turn: 1,
  history: [],
  lastStart: null,
  pendingAction: null,
  connected: false,
};

describe("shouldShowPairingScreen", () => {
  it("keeps an unresolved share link on the pairing screen", () => {
    expect(shouldShowPairingScreen(null, false)).toBe(true);
    expect(shouldShowPairingScreen(idleSnapshot, false)).toBe(true);
  });

  it("shows the game only after a fresh peer connection succeeds", () => {
    expect(shouldShowPairingScreen(idleSnapshot, true)).toBe(false);
  });

  it("keeps an interrupted active match on the game screen", () => {
    expect(
      shouldShowPairingScreen({
        ...idleSnapshot,
        localState: "turn",
        remoteState: "offline",
        lastStart: "local",
      }),
    ).toBe(false);
  });

  it("does not mistake an existing timeline for a fresh connection", () => {
    expect(
      shouldShowPairingScreen({
        ...idleSnapshot,
        history: [{ turn: 1, player: "local", move: { x: 7, y: 7 } }],
      }),
    ).toBe(false);
  });
});
