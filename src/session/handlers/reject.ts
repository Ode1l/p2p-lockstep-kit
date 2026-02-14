import type { RejectPayload } from "../../utils";
import type { SessionDeps } from "../sessionTypes";

export const createRejectHandler = (
  deps: SessionDeps,
  hooks: { resetToLobby: () => void },
) => {
  const { notifier, pending } = deps;
  const { resetToLobby } = hooks;

  return (payload: RejectPayload) => {
    if (payload.action === "undo") {
      notifier.onRejectNotice("Undo rejected");
      pending.reject("undo", payload.reason);
      return;
    }
    if (payload.action === "rejoin") {
      resetToLobby();
      pending.reject("rejoin", payload.reason);
      return;
    }
    if (payload.action === "restart") {
      notifier.onRejectNotice("Restart rejected");
      pending.reject("restart", payload.reason);
    }
  };
};
