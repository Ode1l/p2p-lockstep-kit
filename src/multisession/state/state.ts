import type { ParticipantId } from "../ids";
import type { EventIngestResult, OrderedEvent } from "./events";
import {
  buildGameStateSnapshot,
  type MultiSessionSnapshot,
} from "../observer";
import type { MultiGamePlugin } from "../plugin/types";
import type { JsonValue } from "../../utils/serialization/json";
import { completeConnectionSync, updateConnection } from "./connections";
import { reduceOrderedEvent } from "./reducer";
import {
  AvailabilityFsm,
  LifecycleFsm,
  type AvailabilityState,
  type LifecycleState,
} from "./fsm";
import type {
  MultiSessionState,
  PeerConnectionState,
  ProtocolError,
} from "./types";

export interface StateOptions<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly createInitialState: () => MultiSessionState<TGameState>;
  readonly plugin: MultiGamePlugin<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
}

export class State<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly #createInitialState: () => MultiSessionState<TGameState>;
  readonly #plugin: MultiGamePlugin<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  #state: MultiSessionState<TGameState>;
  #events: OrderedEvent[] = [];
  #lifecycle: LifecycleFsm;
  #availability: AvailabilityFsm;

  constructor(
    options: StateOptions<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >,
  ) {
    this.#createInitialState = options.createInitialState;
    this.#plugin = options.plugin;
    this.#state = options.createInitialState();
    this.#lifecycle = new LifecycleFsm(this.#lifecycleFromState(this.#state));
    this.#availability = new AvailabilityFsm(
      this.#availabilityFromState(this.#state),
    );
  }

  getState(): MultiSessionState<TGameState> {
    return this.#state;
  }

  getHistory(): readonly OrderedEvent[] {
    return this.#events.map((event) => structuredClone(event));
  }

  get lastAppliedSeq(): number {
    return this.#events.length;
  }

  get lifecycle(): LifecycleState {
    return this.#lifecycle.getState();
  }

  get availability(): AvailabilityState {
    return this.#availability.getState();
  }

  snapshot(): MultiSessionSnapshot<TGameSnapshot> {
    return buildGameStateSnapshot(
      this.#state,
      this.#events,
      this.#plugin,
    );
  }

  markJoining(): void {
    this.#lifecycle.transitionTo("joining");
    this.#state = { ...this.#state, phase: "joining" };
  }

  markInvited(): void {
    this.#lifecycle.transitionTo("invited");
    this.#state = { ...this.#state, phase: "invited" };
  }

  updateConnection(
    participantId: ParticipantId,
    connection: PeerConnectionState,
  ): void {
    const next = updateConnection(this.#state, participantId, connection);
    this.#adopt(next);
  }

  completeConnectionSync(): void {
    this.#adopt(completeConnectionSync(this.#state));
  }

  markRecordSynchronized(): void {
    if (!this.#state.meshReady) return;
    this.#state = {
      ...this.#state,
      sync: { status: "complete", atSeq: this.#state.lastAppliedSeq },
    };
  }

  ingest(event: OrderedEvent): EventIngestResult {
    const expectedSeq = this.#events.length + 1;
    if (event.seq < expectedSeq) {
      const existing = this.#events[event.seq - 1];
      return existing?.eventId === event.eventId
        ? { status: "duplicate" }
        : {
            status: "rejected",
            code: "sequence_conflict",
            message: `sequence ${event.seq} is already occupied`,
          };
    }
    if (event.seq > expectedSeq) {
      this.#markSequenceGap(expectedSeq);
      return { status: "gap", expectedSeq, receivedSeq: event.seq };
    }
    const reduced = reduceOrderedEvent(this.#state, event, this.#plugin);
    if (!reduced.ok) {
      return {
        status: "rejected",
        code: "invalid_event",
        message: reduced.error,
      };
    }
    this.#events.push(structuredClone(event));
    this.#adopt(reduced.value);
    return { status: "applied" };
  }

  replaceRecord(events: readonly OrderedEvent[]): void {
    let nextState = this.#createInitialState();
    const nextEvents: OrderedEvent[] = [];
    for (const [index, event] of events.entries()) {
      if (event.seq !== index + 1) {
        throw new Error("sync record is not contiguous");
      }
      const reduced = reduceOrderedEvent(nextState, event, this.#plugin);
      if (!reduced.ok) throw new Error(`sync record rejected: ${reduced.error}`);
      nextState = reduced.value;
      nextEvents.push(structuredClone(event));
    }
    this.#events = nextEvents;
    this.#state = nextState;
    this.#lifecycle = new LifecycleFsm(this.#lifecycleFromState(nextState));
    this.#availability = new AvailabilityFsm(
      this.#availabilityFromState(nextState),
    );
  }

  fail(error: ProtocolError): void {
    this.#availability.transitionTo("failed");
    this.#state = {
      ...this.#state,
      phase: "protocol_error",
      protocolError: error,
    };
  }

  #markSequenceGap(expectedSeq: number): void {
    const previous = this.#state.phase;
    const next: MultiSessionState<TGameState> = {
      ...this.#state,
      phase: "syncing",
      phaseBeforeOffline:
        previous === "offline" || previous === "syncing" || previous === "protocol_error"
          ? this.#state.phaseBeforeOffline
          : previous,
      sync: {
        status: "required",
        reason: "sequence_gap",
        fromSeq: expectedSeq - 1,
      },
    };
    this.#adopt(next);
  }

  #adopt(state: MultiSessionState<TGameState>): void {
    this.#syncFsms(state);
    const availability = this.#availability.getState();
    const phase =
      availability === "failed"
        ? "protocol_error"
        : availability === "offline" || availability === "syncing"
          ? availability
          : this.#lifecycle.getState();
    this.#state = {
      ...state,
      phase,
      phaseBeforeOffline:
        availability === "online" ? null : this.#lifecycle.getState(),
    };
  }

  #syncFsms(state: MultiSessionState<TGameState>): void {
    const lifecycle = this.#lifecycleFromState(state);
    const availability = this.#availabilityFromState(state);
    this.#lifecycle.transitionTo(lifecycle);
    this.#availability.transitionTo(availability);
  }

  #lifecycleFromState(state: MultiSessionState<TGameState>): LifecycleState {
    const phase =
      state.phase === "offline" ||
      state.phase === "syncing" ||
      state.phase === "protocol_error"
        ? state.phaseBeforeOffline ?? "seated"
        : state.phase;
    return phase;
  }

  #availabilityFromState(
    state: MultiSessionState<TGameState>,
  ): AvailabilityState {
    if (state.phase === "offline") return "offline";
    if (state.phase === "syncing") return "syncing";
    if (state.phase === "protocol_error") return "failed";
    return "online";
  }
}
