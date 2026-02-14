import type { MovePayload, RejectPayload } from "../../utils";
import type { GameMove, GameStatus } from "../types";
import type { SessionDeps } from "../../session/sessionTypes";
import { createMovePolicy } from "../rules";

export const createMoveHandlers = (deps: SessionDeps) => {
  const { state, messageSender, notifier } = deps;
  const movePolicy = createMovePolicy({
    getStatus: state.getStatus,
    isStarted: state.startedState.is,
    hasPeer: () => !!state.peer.getId(),
    getMyColor: state.player.getMyColor,
    canApplyByRule: state.ruleGuard.canApplyMove,
    onLocalRejected: notifier.onMoveRejected,
  });

  const handleMoveReject = (
    payload: RejectPayload,
    meta: { turn?: number; stateHash?: string },
  ) => {
    notifier.onMoveRejected(payload.reason);
    const status = state.getStatus();
    if (meta.turn === undefined) {
      notifier.onRejectSync("[shell] reject missing turn, requesting sync");
      messageSender.sendSyncRequest();
      return;
    }
    const turnDiff = status.turn - meta.turn;
    if (turnDiff === 1) {
      const ok = state.rollbackLastMove();
      if (!ok) {
        messageSender.sendSyncRequest();
        return;
      }
      if (meta.stateHash && state.game.getHash() !== meta.stateHash) {
        notifier.onRejectSync("[shell] reject hash mismatch, requesting sync");
        messageSender.sendSyncRequest();
      }
    } else {
      notifier.onRejectSync("[shell] reject mismatch, requesting sync");
      messageSender.sendSyncRequest();
    }
  };

  const handleMove = (
    payload: MovePayload,
    meta: { turn?: number; stateHash?: string },
    origin: "local" | "remote",
  ) => {
    const move: GameMove = {
      x: payload.x,
      y: payload.y,
      player: payload.player,
      turn: meta.turn ?? state.getStatus().turn,
    };
    const guard =
      origin === "local"
        ? movePolicy.validateLocalMove(move)
        : movePolicy.validateRemoteMove(move);
    if (!guard.ok) {
      if (origin === "remote") {
        messageSender.sendReject("move", guard.reason ?? "invalid");
      }
      return;
    }
    const prevStatus: GameStatus = state.getStatus();
    state.applyMove(move);
    if (origin === "remote" && meta.stateHash && meta.stateHash !== state.game.getHash()) {
      state.rollbackLastMove();
      messageSender.sendReject("move", "hash-mismatch");
      return;
    }
    state.finalizeMove(prevStatus);
    if (origin === "local") {
      messageSender.sendMove(move);
    }
  };

  return {
    validateLocalMove: movePolicy.validateLocalMove,
    validateRemoteMove: movePolicy.validateRemoteMove,
    handleMove,
    handleMoveReject,
  };
};
