import type { ParticipantId, PeerId } from "./ids";
import type { IdFactory } from "./host/idFactory";
import type { PreConnectionManager } from "./connection/preConnection";
import type { GameStateObserver } from "./observer";
import type { MultiGamePlugin } from "./plugin/types";
import type { State } from "./state/state";
import type { Participant, ProtocolError } from "./state/types";
import type { JsonValue } from "../utils/serialization/json";
import type { NetClient } from "./net";

export class SessionContext<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly state: State<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly net: NetClient;
  readonly observer: GameStateObserver<TGameSnapshot>;
  readonly plugin: MultiGamePlugin<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly idFactory: IdFactory;
  readonly preConnection: PreConnectionManager<TGameState>;
  readonly localParticipant: Omit<Participant, "joinedAtSeq">;
  readonly hostPeerId: PeerId;
  readonly isHost: boolean;

  constructor(input: {
    state: State<TCommand, TEventPayload, TGameState, TGameSnapshot>;
    net: NetClient;
    observer: GameStateObserver<TGameSnapshot>;
    plugin: MultiGamePlugin<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >;
    idFactory: IdFactory;
    preConnection: PreConnectionManager<TGameState>;
    localParticipant: Omit<Participant, "joinedAtSeq">;
    hostPeerId: PeerId;
    isHost: boolean;
  }) {
    this.state = input.state;
    this.net = input.net;
    this.observer = input.observer;
    this.plugin = input.plugin;
    this.idFactory = input.idFactory;
    this.preConnection = input.preConnection;
    this.localParticipant = input.localParticipant;
    this.hostPeerId = input.hostPeerId;
    this.isHost = input.isHost;
  }

  participantForPeer(peerId: PeerId): Participant | null {
    return this.preConnection.participantForPeer(this.state.getState(), peerId);
  }

  participant(participantId: ParticipantId): Participant | null {
    return this.state.getState().participants.get(participantId) ?? null;
  }

  notify(): void {
    this.observer.notify(this.state.snapshot());
  }

  fail(error: ProtocolError): void {
    this.state.fail(error);
    this.observer.notifyError(error);
    this.notify();
  }
}
