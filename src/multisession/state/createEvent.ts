import type { GameId, ParticipantId, PeerId } from "../ids";
import type { OrderedEvent, SessionEventSpec } from "./events";

export const createOrderedEvent = (input: {
  eventId: string;
  hostPeerId: PeerId;
  gameId: GameId;
  seq: number;
  actorId: ParticipantId;
  spec: SessionEventSpec;
}): OrderedEvent => ({
  eventId: input.eventId,
  hostPeerId: input.hostPeerId,
  gameId: input.gameId,
  seq: input.seq,
  actorId: input.actorId,
  type: input.spec.type,
  payload: input.spec.payload as never,
});
