import type { SessionDeps } from "../sessionTypes";

export const createApproveHandler = (
  deps: SessionDeps,
  hooks: {
    getPendingAction: () => "undo" | "rejoin" | "restart" | null;
    setPendingAction: (next: "undo" | "rejoin" | "restart" | null) => void;
    getPendingUndoCount: () => 1 | 2 | null;
    setPendingUndoCount: (next: 1 | 2 | null) => void;
    resetToLobby: () => void;
  },
) => {
  const { state, messageSender } = deps;
  const {
    getPendingAction,
    setPendingAction,
    getPendingUndoCount,
    setPendingUndoCount,
    resetToLobby,
  } = hooks;

  return () => {
    const pending = getPendingAction();
    if (!pending) {
      return;
    }
    if (pending === "undo") {
      const count = getPendingUndoCount();
      if (count) {
        state.applyUndoCount(count);
      }
      setPendingUndoCount(null);
      setPendingAction(null);
      return;
    }
    if (pending === "rejoin") {
      messageSender.sendSyncState();
      state.startedState.set(true);
      state.ready.clear();
      setPendingAction(null);
      return;
    }
    if (pending === "restart") {
      resetToLobby();
      setPendingAction(null);
    }
  };
};
