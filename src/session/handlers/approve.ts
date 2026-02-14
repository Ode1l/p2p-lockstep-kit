import type { SessionDeps } from "../sessionTypes";

export const createApproveHandler = (
  deps: SessionDeps,
  hooks: {
    resetToLobby: () => void;
  },
) => {
  const { state, messageSender, fsm, pending } = deps;
  const { resetToLobby } = hooks;

  return () => {
    const current = pending.getAction();
    if (!current) {
      return;
    }
    if (current === "undo") {
      const count = pending.getUndoCount();
      if (count) {
        state.applyUndoCount(count);
      }
      pending.resolve("undo");
      return;
    }
    if (current === "rejoin") {
      messageSender.sendSyncState();
      state.startedState.set(true);
      state.ready.clear();
      fsm.onMatchStart("rejoin-approve");
      pending.resolve("rejoin");
      return;
    }
    if (current === "restart") {
      resetToLobby();
      pending.resolve("restart");
    }
  };
};
