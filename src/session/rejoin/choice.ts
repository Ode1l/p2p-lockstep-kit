import type { SessionDeps } from "../sessionTypes";
import type { PendingAction } from "../state/pending";

export const createRejoinChoiceControl = (
  deps: SessionDeps,
  hooks: {
    setPendingAction: (next: PendingAction) => void;
  },
) => {
  const { state, ui, messageSender } = deps;
  const { setPendingAction } = hooks;

  return async () => {
    if (!state.hasCache()) {
      return;
    }
    const choice = await (ui.promptRejoinChoice?.() ?? Promise.resolve("restart"));
    if (choice === "restart") {
      state.resetToLobby();
      return;
    }
    const { cacheHash, cacheTurn } = state.getCacheMeta();
    setPendingAction("rejoin");
    messageSender.sendRejoin(cacheTurn, cacheHash);
  };
};
