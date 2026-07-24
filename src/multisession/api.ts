import type {
  GameId,
  ParticipantId,
  PeerId,
  ProposalId,
} from "./ids";
import type { MultiSessionObserver, MultiSessionSnapshot } from "./observer";
import type { JsonValue } from "../utils/serialization/json";
import type { MultiPeerTransport, Unsubscribe } from "./transport/types";
import type { Participant, SessionConfiguration } from "./state/types";
import type { MultiGamePlugin } from "./plugin/types";
import type { IdFactory } from "./host/idFactory";
import type { SeatSelector } from "./connection/preConnection";

export type {
  SeatSelectionContext,
  SeatSelector,
} from "./connection/preConnection";

export interface MultiSessionOptions<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly gameId: GameId;
  readonly localParticipant: Omit<Participant, "joinedAtSeq">;
  readonly hostId: ParticipantId;
  readonly hostPeerId: PeerId;
  readonly configuration: SessionConfiguration;
  readonly plugin: MultiGamePlugin<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly transport: MultiPeerTransport;
  readonly idFactory?: IdFactory;
  readonly ownsTransport?: boolean;
  readonly maxConcurrentConnections?: number;
  readonly selectSeat?: SeatSelector;
}

export interface JoinOptions {
  readonly displayName?: string;
}

export interface MultiSessionActions<TCommand extends JsonValue = JsonValue> {
  join(options?: JoinOptions): Promise<void>;
  setDisplayName(displayName: string): Promise<void>;
  ready(ready?: boolean): Promise<void>;
  start(): Promise<void>;
  move(command: TCommand): Promise<void>;
  proposeRestart(id?: ProposalId): Promise<void>;
  voteRestart(id: ProposalId, approve: boolean): Promise<void>;
  resume(): Promise<void>;
  sendPrivate(
    participantId: ParticipantId,
    data: JsonValue,
    relatedEventId?: string,
  ): void;
}

export interface MultiSessionObserverApi<TGameSnapshot extends JsonValue> {
  subscribe(observer: MultiSessionObserver<TGameSnapshot>): Unsubscribe;
  getSnapshot(): MultiSessionSnapshot<TGameSnapshot> | null;
}
