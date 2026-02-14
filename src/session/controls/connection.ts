import type { SessionDeps } from "../sessionTypes";

export const createConnectionControl = (
  deps: SessionDeps,
  hooks: { maybePromptRejoinChoice: () => Promise<void> },
) => {
  const { state, notifier } = deps;
  const { maybePromptRejoinChoice } = hooks;
  let connected = false;

  return (connState: RTCPeerConnectionState) => {
    const nowConnected = connState === "connected";
    if (nowConnected && !connected) {
      connected = true;
      state.connectionState.set(true);
      state.ready.clear();
      state.startedState.set(false);
      notifier.onConnection("[shell] datachannel connected");
      void maybePromptRejoinChoice();
    }
    if (!nowConnected && connected) {
      connected = false;
      state.connectionState.set(false);
      state.ready.clear();
      state.startedState.set(false);
      notifier.onConnection("[shell] datachannel disconnected");
    }
    state.render();
  };
};
