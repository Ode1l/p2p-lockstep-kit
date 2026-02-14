import type { SessionDeps } from "../sessionTypes";

export const createRejoinChoiceControl = (deps: SessionDeps) => {
  const { state, ui, messageSender, pending } = deps;

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
    void pending.begin("rejoin");
    messageSender.sendRejoin(cacheTurn, cacheHash);
  };
};
