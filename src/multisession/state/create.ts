import type { GameId, ParticipantId, PeerId } from "../ids";
import type { Participant } from "./types";
import type {
  MultiSessionState,
  SessionConfiguration,
} from "./types";

export const createInitialSessionState = <TGameState>(input: {
  hostPeerId: PeerId;
  gameId: GameId;
  localParticipant: Participant;
  hostId: ParticipantId;
  configuration: SessionConfiguration;
  phase?: "invited" | "mesh_connecting";
}): MultiSessionState<TGameState> => {
  const participants = new Map();
  const connections = new Map();
  const seats = new Map(input.configuration.seatIds.map((id) => [id, null]));
  const ready = new Map();

  return {
    hostPeerId: input.hostPeerId,
    gameId: input.gameId,
    phase: input.phase ?? "mesh_connecting",
    phaseBeforeOffline: null,
    localParticipantId: input.localParticipant.id,
    hostId: input.hostId,
    configuration: input.configuration,
    participants,
    connections,
    seats,
    ready,
    meshReady: false,
    lastAppliedSeq: 0,
    pendingDecisionWindow: null,
    pendingRestart: null,
    sync: { status: "idle" },
    outcome: null,
    game: null,
    protocolError: null,
  };
};
