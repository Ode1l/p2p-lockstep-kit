import type { SessionDeps } from "../sessionTypes";

export const createRejoinHandler = (
  deps: SessionDeps,
  hooks: { resumeTTLms: number; resetToLobby: () => void },
) => {
  const { state, ui, messageSender, fsm } = deps;
  const { resumeTTLms, resetToLobby } = hooks;

  return async (meta: { turn?: number; stateHash?: string }) => {
    if (meta.turn === undefined) {
      messageSender.sendReject("rejoin", "cache-mismatch");
      resetToLobby();
      return;
    }
    const cacheHash = meta.stateHash ?? "";
    const canResume =
      !!cacheHash && state.canRestore({ cacheHash, turn: meta.turn }, resumeTTLms);
    if (!canResume) {
      messageSender.sendReject("rejoin", "cache-mismatch");
      resetToLobby();
      return;
    }
    const approved = await (ui.promptRejoinApprove?.() ?? Promise.resolve(false));
    if (approved) {
      messageSender.sendApprove();
      state.startedState.set(true);
      state.ready.clear();
      fsm.onMatchStart("rejoin-approved");
    } else {
      messageSender.sendReject("rejoin", "rejected");
      resetToLobby();
    }
    state.render();
  };
};
