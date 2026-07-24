import type { ParticipantId } from "../ids";
import type { SessionContext } from "../context";
import {
  commandEventSpecs,
  orderEventSpecs,
} from "../host/commands";
import type {
  CommandRequestPayload,
  SessionCommand,
} from "../../utils/protocol/multisession";
import type { JsonValue } from "../../utils/serialization/json";
import type { SyncHandler } from "./sync";

export class CommandHandler<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly #context: SessionContext<
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
  constructor(
    context: SessionContext<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >,
    sync: SyncHandler<TCommand, TEventPayload, TGameState, TGameSnapshot>,
  ) {
    this.#context = context;
    this.#sync = sync;
  }

  submit(command: SessionCommand): Promise<void> {
    const state = this.#context.state.getState();
    if (
      state.phase === "offline" ||
      state.phase === "syncing" ||
      state.phase === "protocol_error"
    ) {
      return Promise.reject(
        new Error("commands are disabled while offline, syncing or conflicted"),
      );
    }
    const request: CommandRequestPayload = {
      expectedSeq: state.lastAppliedSeq,
      command,
    };
    if (this.#context.isHost) {
      return this.process(this.#context.localParticipant.id, request);
    }
    const host = state.participants.get(state.hostId);
    if (!host) {
      return Promise.reject(new Error("host is not in the roster"));
    }
    this.#context.net.sendTo(state, host.peerId, "COMMAND_REQUEST", request);
    return Promise.resolve();
  }

  async process(
    actorId: ParticipantId,
    request: CommandRequestPayload,
  ): Promise<void> {
    if (!this.#context.isHost) return;
    const specs = commandEventSpecs(
      this.#context.state.getState(),
      actorId,
      request,
      this.#context.plugin,
    );
    if (!specs.ok) throw new Error(specs.error);
    const ordered = orderEventSpecs({
      state: this.#context.state.getState(),
      actorId,
      specs: specs.value,
      plugin: this.#context.plugin,
      idFactory: this.#context.idFactory,
    });
    if (!ordered.ok) throw new Error(ordered.error);
    await this.#sync.applyEvents(
      ordered.value.events,
      this.#context.localParticipant.peerId,
    );
    this.#context.net.broadcast(
      this.#context.state.getState(),
      "ORDERED_EVENTS",
      { events: ordered.value.events },
      undefined,
      ordered.value.events[0]?.gameId,
    );
  }

}
