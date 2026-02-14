import type { SessionDeps } from "../sessionTypes";

export const createRestartHandler = (
  deps: SessionDeps,
  hooks: {
    resetToLobby: () => void;
  },
) => {
  const { ui, messageSender, pending } = deps;
  const { resetToLobby } = hooks;

  return async (origin: "local" | "remote") => {
    if (origin === "local") {
      if (!deps.state.peer.getId()) {
        return;
      }
      const wait = pending.begin("restart");
      messageSender.sendRestart();
      await wait;
      return;
    }
    const approved = await (ui.promptRestart?.() ?? false);
    if (approved) {
      messageSender.sendApprove();
      resetToLobby();
    } else {
      messageSender.sendReject("restart", "rejected");
    }
  };
};
