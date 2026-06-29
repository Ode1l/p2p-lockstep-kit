import type { GameStateSnapshot } from "p2p-lockstep-kit-session";

export const shouldShowPairingScreen = (
  snapshot: GameStateSnapshot | null,
  connected = snapshot?.connected ?? false,
) => {
  const isFreshConnection =
    !snapshot ||
    (snapshot.localState === "idle" &&
      snapshot.remoteState === "idle" &&
      snapshot.lastStart === null &&
      snapshot.history.length === 0);

  return !connected && isFreshConnection;
};
