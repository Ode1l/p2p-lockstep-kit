import type {
  JsonValue,
  MultiGamePlugin,
  MultiSession,
  MultiSessionSnapshot,
  OrderedEvent,
  Participant,
  ParticipantId,
  PeerId,
  SeatId,
  SeatSelector,
  SessionConfiguration,
} from "p2p-lockstep-kit-multisession";

export type MultiUiRuntime<
  TCommand extends JsonValue = JsonValue,
  TGameSnapshot extends JsonValue = JsonValue,
> = Pick<MultiSession<TCommand, TGameSnapshot>, "actions" | "observer">;

export interface MultiUiGame<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly title: string;
  readonly mark?: string;
  readonly configuration: SessionConfiguration;
  readonly plugin: MultiGamePlugin<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly selectSeat?: SeatSelector;
  readonly seatLabel?: (seatId: SeatId) => string;
  readonly eventLabel?: (
    event: OrderedEvent,
    snapshot: MultiSessionSnapshot<TGameSnapshot>,
  ) => string | null;
}

export interface MultiUiOptions<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly game: MultiUiGame<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly signalUrl?: string;
  readonly hostPeerId?: string | null;
  readonly displayName?: string;
  readonly locationHref?: string;
}

export interface MultiTableView<
  TGameSnapshot extends JsonValue = JsonValue,
> {
  readonly snapshot: MultiSessionSnapshot<TGameSnapshot>;
  readonly events: readonly OrderedEvent[];
  readonly localPeerId: PeerId;
  readonly hostPeerId: PeerId;
  readonly error: string | null;
}

export interface MultiTableController<
  TCommand extends JsonValue,
  TGameSnapshot extends JsonValue,
> {
  readonly runtime: MultiUiRuntime<TCommand, TGameSnapshot>;
  subscribe(handler: (view: MultiTableView<TGameSnapshot>) => void): () => void;
  setDisplayName(displayName: string): Promise<void>;
  ready(): Promise<void>;
  start(): Promise<void>;
  restart(): Promise<void>;
  resume(): Promise<void>;
  dispose(): void;
}

export interface MultiUiViewOptions<TGameSnapshot extends JsonValue> {
  readonly busy: boolean;
  readonly copyNotice: string | null;
  readonly invitationUrl: string;
  readonly invitationQrDataUrl: string | null;
  readonly invitationQrFailed: boolean;
  readonly displayNameEditor: Readonly<{
    open: boolean;
    value: string;
    error: string | null;
  }>;
  readonly seatLabel?: (seatId: SeatId) => string;
  readonly eventLabel?: (
    event: OrderedEvent,
    snapshot: MultiSessionSnapshot<TGameSnapshot>,
  ) => string | null;
}

export const participantName = (
  participantId: ParticipantId,
  participants: ReadonlyMap<ParticipantId, Participant>,
): string =>
  participants.get(participantId)?.displayName ?? String(participantId);
