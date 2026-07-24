import type {
  GameId,
  ParticipantId,
  PeerId,
  ProposalId,
  SeatId,
} from "../ids";
import type { JsonObject, JsonValue } from "../../utils/serialization/json";
import type { GameOutcome } from "./types";

export interface OrderedEvent<
  TType extends string = string,
  TPayload = JsonValue,
> {
  readonly eventId: string;
  readonly hostPeerId: PeerId;
  readonly gameId: GameId;
  readonly seq: number;
  readonly actorId: ParticipantId;
  readonly type: TType;
  readonly payload: TPayload;
}

export type CoreEventType =
  | "MEMBERSHIP_JOINED"
  | "PEER_BINDING_UPDATED"
  | "DISPLAY_NAME_CHANGED"
  | "READY_CHANGED"
  | "GAME_STARTED"
  | "GAME_EVENT"
  | "GAME_ENDED"
  | "RESTART_PROPOSED"
  | "RESTART_VOTED"
  | "GAME_RESTARTED";

export type CoreEventPayload =
  | Readonly<{
      participantId: ParticipantId;
      peerId: PeerId;
      seatId: SeatId;
      displayName?: string;
    }>
  | Readonly<{ participantId: ParticipantId; peerId: PeerId }>
  | Readonly<{ participantId: ParticipantId; displayName: string }>
  | Readonly<{ participantId: ParticipantId; ready: boolean }>
  | JsonObject
  | Readonly<{ gameType: string; data: JsonValue }>
  | Readonly<{ outcome: GameOutcome }>
  | Readonly<{ proposalId: ProposalId }>
  | Readonly<{
      proposalId: ProposalId;
      participantId: ParticipantId;
      approve: boolean;
    }>
  | Readonly<{ proposalId: ProposalId; nextGameId: GameId }>;

export interface SessionEventSpec {
  readonly type: CoreEventType;
  readonly payload: CoreEventPayload;
}

export type EventIngestResult =
  | Readonly<{ status: "applied" }>
  | Readonly<{ status: "duplicate" }>
  | Readonly<{ status: "gap"; expectedSeq: number; receivedSeq: number }>
  | Readonly<{
      status: "rejected";
      code: "invalid_event" | "sequence_conflict";
      message: string;
    }>;
