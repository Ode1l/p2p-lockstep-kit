import type { RejectPayload } from "../../utils";
import type { SessionDeps } from "../sessionTypes";

export const createRejectHandler = (
  deps: SessionDeps,
  hooks: {
    getPendingAction: () => "undo" | "rejoin" | "restart" | null;
    setPendingAction: (next: "undo" | "rejoin" | "restart" | null) => void;
    setPendingUndoCount: (next: 1 | 2 | null) => void;
    resetToLobby: () => void;
  },
) => {
  const { notifier } = deps;
  const {
    getPendingAction,
    setPendingAction,
    setPendingUndoCount,
    resetToLobby,
  } = hooks;

  return (payload: RejectPayload) => {
    if (payload.action === "undo") {
      notifier.onRejectNotice("Undo rejected");
      setPendingUndoCount(null);
      if (getPendingAction() === "undo") {
        setPendingAction(null);
      }
      return;
    }
    if (payload.action === "rejoin") {
      resetToLobby();
      if (getPendingAction() === "rejoin") {
        setPendingAction(null);
      }
      return;
    }
    if (payload.action === "restart") {
      notifier.onRejectNotice("Restart rejected");
      if (getPendingAction() === "restart") {
        setPendingAction(null);
      }
      return;
    }
  };
};
