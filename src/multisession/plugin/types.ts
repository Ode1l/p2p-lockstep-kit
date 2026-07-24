import type { GameId, ParticipantId, PeerId, SeatId } from "../ids";
import type { JsonObject, JsonValue } from "../../utils/serialization/json";
import type { Result } from "../../utils/result";
import type {
  DecisionWindow,
  GameOutcome,
  Participant,
} from "../state/types";

export interface GameEventSpec<TPayload extends JsonValue = JsonValue> {
  readonly type: string;
  readonly payload: TPayload;
}

export interface GamePluginContext<TState> {
  readonly hostPeerId: PeerId;
  readonly gameId: GameId;
  readonly actorId: ParticipantId;
  readonly participantCount: number;
  readonly participants: ReadonlyMap<ParticipantId, Participant>;
  readonly seats: ReadonlyMap<SeatId, ParticipantId | null>;
  readonly state: TState;
  readonly lastAppliedSeq: number;
}

export interface MultiGamePlugin<
  TCommand extends JsonValue = JsonValue,
  TEventPayload extends JsonValue = JsonValue,
  TState = unknown,
  TSnapshot extends JsonValue = JsonValue,
> {
  readonly id: string;
  parseCommand(input: unknown): Result<TCommand>;
  parseEvent(type: string, payload: unknown): Result<TEventPayload>;
  createStartPayload?(input: {
    hostPeerId: PeerId;
    gameId: GameId;
    participantCount: number;
    participants: ReadonlyMap<ParticipantId, Participant>;
    seats: ReadonlyMap<SeatId, ParticipantId | null>;
  }): JsonObject;
  createInitialState(input: {
    hostPeerId: PeerId;
    gameId: GameId;
    participantCount: number;
    participants: ReadonlyMap<ParticipantId, Participant>;
    seats: ReadonlyMap<SeatId, ParticipantId | null>;
    startPayload?: JsonObject;
  }): TState;
  validateCommand(
    command: TCommand,
    context: GamePluginContext<TState>,
  ): Result<true>;
  commandToEvents(
    command: TCommand,
    context: GamePluginContext<TState>,
  ): readonly GameEventSpec<TEventPayload>[];
  validateEvent(
    event: GameEventSpec<TEventPayload>,
    context: GamePluginContext<TState>,
  ): Result<true>;
  reduce(
    state: TState,
    event: GameEventSpec<TEventPayload>,
    context: Omit<GamePluginContext<TState>, "state">,
  ): TState;
  getDecisionWindow(state: TState): DecisionWindow | null;
  getOutcome(state: TState): GameOutcome | null;
  createSnapshot(state: TState): TSnapshot;
  restoreSnapshot(snapshot: unknown): Result<TState>;
}
