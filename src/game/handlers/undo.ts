import type { UndoPayload } from "../../utils";
import type { SessionDeps } from "../../session/sessionTypes";

export const createUndoHandler = (deps: SessionDeps) => {
  const { state, ui, messageSender, pending } = deps;

  return async (payload: { count?: UndoPayload["count"] }, origin: "local" | "remote") => {
    if (origin === "local") {
      if (!state.peer.getId() || !state.startedState.is() || !state.history.has()) {
        return;
      }
      const status = state.getStatus();
      const myColor = state.player.getMyColor();
      const count: 1 | 2 = myColor && status.currentPlayer === myColor ? 2 : 1;
      if (count === 2 && state.history.length() < 2) {
        return;
      }
      const wait = pending.begin("undo", { undoCount: count });
      messageSender.sendUndo(count);
      await wait;
      return;
    }

    if (!state.startedState.is()) {
      messageSender.sendReject("undo", "not-started");
      return;
    }
    if (!payload.count) {
      messageSender.sendReject("undo", "invalid");
      return;
    }
    if (payload.count === 2 && state.history.length() < 2) {
      messageSender.sendReject("undo", "no-history");
      return;
    }
    const approved = await (ui.promptUndo?.() ?? Promise.resolve(false));
    if (approved) {
      messageSender.sendApprove();
      state.applyUndoCount(payload.count);
    } else {
      messageSender.sendReject("undo", "rejected");
    }
  };
};
