import type { SessionDeps } from "../sessionTypes";

export const createRestartHandler = (
  deps: SessionDeps,
  hooks: {
    resetToLobby: () => void;
    setPendingAction: (next: "undo" | "rejoin" | "restart" | null) => void;
  },
) => {
  const { ui, messageSender } = deps;
  const { resetToLobby, setPendingAction } = hooks;

  return async (origin: "local" | "remote") => {
    if (origin === "local") {
      if (!deps.state.peer.getId()) {
        return;
      }
      setPendingAction("restart");
      messageSender.sendRestart();
      return;
    }
    const approved = await (ui.promptRestart?.() ?? Promise.resolve(false));
    if (approved) {
      messageSender.sendApprove();
      resetToLobby();
    } else {
      messageSender.sendReject("restart", "rejected");
    }
  };
};
