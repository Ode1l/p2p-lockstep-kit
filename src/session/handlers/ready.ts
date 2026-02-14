import type { ReadyPayload } from "../../utils";
import type { SessionDeps } from "../sessionTypes";

export const createReadyHandler = (deps: SessionDeps) => {
  const { state, messageSender } = deps;

  return (payload: ReadyPayload, origin: "local" | "remote") => {
    if (origin === "local") {
      if (!state.peer.getId()) {
        return;
      }
      state.ready.setSelf(payload.ready);
      state.startedState.set(false);
      messageSender.sendReady(payload.ready);
      state.render();
      return;
    }
    state.ready.setPeer(payload.ready);
    state.startedState.set(false);
    state.render();
  };
};
