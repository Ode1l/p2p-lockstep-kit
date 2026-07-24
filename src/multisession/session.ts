import {
  membershipEventSpec,
  orderEventSpecs,
} from "./host/commands";
import { createIdFactory } from "./host/idFactory";
import { GameStateObserver, type MultiSessionObserver } from "./observer";
import type { JsonValue } from "../utils/serialization/json";
import type {
  MultiSessionActions,
  MultiSessionObserverApi,
  MultiSessionOptions,
} from "./api";
import { LocalActionsAPI } from "./actions";
import { CommandBus } from "./commandBus";
import { SessionContext } from "./context";
import {
  PreConnectionManager,
} from "./connection/preConnection";
import { CommandHandler } from "./handlers/command";
import { MembershipHandler } from "./handlers/membership";
import { ProtocolHandler } from "./handlers/protocol";
import { SyncHandler } from "./handlers/sync";
import { registerHandlers } from "./handlers/busRegister";
import { createNetClient } from "./net";
import { State } from "./state/state";
import { createInitialSessionState } from "./state/create";
import type { MultiSessionState } from "./state/types";
import type { Unsubscribe } from "./transport/types";

export type {
  SeatSelectionContext,
  SeatSelector,
} from "./connection/preConnection";

export class Session<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly #options: MultiSessionOptions<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly #observer = new GameStateObserver<TGameSnapshot>();
  readonly #bus = new CommandBus();
  readonly #state: State<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly #context: SessionContext<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly #command: CommandHandler<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly #protocol: ProtocolHandler<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly #sync: SyncHandler<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly #unsubscribers: Unsubscribe[] = [];
  readonly actions: MultiSessionActions<TCommand>;
  readonly observer: MultiSessionObserverApi<TGameSnapshot>;
  #started = false;
  #disposed = false;

  constructor(
    options: MultiSessionOptions<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >,
  ) {
    if (options.transport.localPeerId !== options.localParticipant.peerId) {
      throw new Error("transport localPeerId must match local participant peerId");
    }
    const maxConcurrentConnections = options.maxConcurrentConnections ?? 3;
    if (
      !Number.isInteger(maxConcurrentConnections) ||
      maxConcurrentConnections < 1 ||
      maxConcurrentConnections > 10
    ) {
      throw new RangeError(
        "maxConcurrentConnections must be an integer between 1 and 10",
      );
    }

    this.#options = options;
    const idFactory = options.idFactory ?? createIdFactory();
    const preConnection = new PreConnectionManager<TGameState>(
      options.selectSeat,
    );
    this.#state = new State({
      createInitialState: () => this.#createBaseState(),
      plugin: options.plugin,
    });
    const net = createNetClient({
      transport: options.transport,
      localParticipant: options.localParticipant,
      maxConcurrentConnections,
      ownsTransport: options.ownsTransport === true,
    });
    this.#context = new SessionContext({
      state: this.#state,
      net,
      observer: this.#observer,
      plugin: options.plugin,
      idFactory,
      preConnection,
      localParticipant: options.localParticipant,
      hostPeerId: options.hostPeerId,
      isHost: this.isHost,
    });
    this.#sync = new SyncHandler(this.#context);
    this.#command = new CommandHandler(this.#context, this.#sync);
    const membership = new MembershipHandler(this.#context, this.#sync);
    this.#protocol = new ProtocolHandler({
      context: this.#context,
      command: this.#command,
      membership,
      sync: this.#sync,
    });
    registerHandlers({
      bus: this.#bus,
      context: this.#context,
      command: this.#command,
      membership,
      protocol: this.#protocol,
      sync: this.#sync,
    });

    this.actions = Object.freeze(new LocalActionsAPI<TCommand>(this.#bus));
    this.observer = Object.freeze({
      subscribe: (observer: MultiSessionObserver<TGameSnapshot>) =>
        this.#observer.subscribe(observer),
      getSnapshot: () => this.#observer.getSnapshot(),
    });
  }

  get isHost(): boolean {
    return (
      this.#options.localParticipant.id === this.#options.hostId
    );
  }

  async start(): Promise<void> {
    this.#assertActive();
    if (this.#started) return;
    this.#started = true;
    this.#unsubscribers.push(
      this.#context.net.onMessage((peerId, message) => {
        void this.#bus
          .dispatch({
            type: "PROTOCOL_MESSAGE",
            sourcePeerId: peerId,
            raw: message,
          })
          .catch((error: unknown) => {
            this.#context.fail({
              code: "invalid_message",
              message:
                error instanceof Error
                  ? error.message
                  : "message handler failed",
              peerId,
            });
          });
      }),
      this.#context.net.onPeerStateChange((peerId, connection) => {
        void this.#bus
          .dispatch({ type: "PEER_STATE", peerId, connection })
          .catch((error: unknown) => {
            this.#context.fail({
              code: "invalid_message",
              message:
                error instanceof Error
                  ? error.message
                  : "peer-state handler failed",
              peerId,
            });
          });
      }),
    );

    if (this.isHost && this.#state.lastAppliedSeq === 0) {
      const seat = this.#context.preConnection.selectAvailableSeat(
        this.#state.getState(),
        this.#options.localParticipant,
      );
      const ordered = orderEventSpecs({
        state: this.#state.getState(),
        actorId: this.#state.getState().hostId,
        specs: [
          membershipEventSpec({
            participant: this.#options.localParticipant,
            seatId: seat,
          }),
        ],
        plugin: this.#options.plugin,
        idFactory: this.#context.idFactory,
      });
      if (!ordered.ok) throw new Error(ordered.error);
      await this.#sync.applyEvents(
        ordered.value.events,
        this.#options.localParticipant.peerId,
      );
    }
    this.#context.notify();
  }

  idle(): Promise<void> {
    return this.#bus.idle();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const unsubscribe of this.#unsubscribers.splice(0)) unsubscribe();
    this.#observer.clear();
    this.#bus.dispose();
    this.#context.net.dispose();
  }

  #createBaseState(): MultiSessionState<TGameState> {
    return createInitialSessionState<TGameState>({
      hostPeerId: this.#options.hostPeerId,
      gameId: this.#options.gameId,
      localParticipant: {
        ...this.#options.localParticipant,
        joinedAtSeq: 0,
      },
      hostId: this.#options.hostId,
      configuration: this.#options.configuration,
      phase: this.isHost ? "mesh_connecting" : "invited",
    });
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error("runtime is disposed");
  }
}
