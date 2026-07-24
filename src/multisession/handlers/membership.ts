import type { PeerId } from "../ids";
import type { SessionContext } from "../context";
import {
  membershipEventSpec,
  orderEventSpecs,
} from "../host/commands";
import type { JoinOptions } from "../api";
import type { ProtocolMessage } from "../../utils/protocol/multisession";
import type { JsonValue } from "../../utils/serialization/json";
import type { SyncHandler } from "./sync";

export class MembershipHandler<
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

  async join(options: JoinOptions): Promise<void> {
    if (this.#context.isHost) {
      throw new Error("host is already a member");
    }
    if (this.#context.state.getState().phase !== "invited") {
      throw new Error("session is not invited");
    }
    this.#context.state.markJoining();
    this.#context.notify();
    await this.#context.net.connect(this.#context.hostPeerId);
    this.#context.net.sendTo(
      this.#context.state.getState(),
      this.#context.hostPeerId,
      "JOIN_REQUEST",
      {
        participantId: this.#context.localParticipant.id,
        ...(options.displayName === undefined
          ? {}
          : { displayName: options.displayName }),
      },
      null,
    );
  }

  async accept(
    sourcePeerId: PeerId,
    message: Extract<ProtocolMessage, { type: "JOIN_REQUEST" }>,
  ): Promise<void> {
    if (!this.#context.isHost) return;
    const state = this.#context.state.getState();
    const existingParticipant = state.participants.get(
      message.payload.participantId,
    );
    const existingPeerParticipant = this.#context.participantForPeer(
      sourcePeerId,
    );
    if (existingParticipant || existingPeerParticipant) {
      if (
        existingParticipant?.peerId !== sourcePeerId ||
        existingPeerParticipant?.id !== message.payload.participantId
      ) {
        this.#reject(sourcePeerId, "participantId or peerId is already reserved");
        return;
      }
      const events = this.#context.state.getHistory();
      this.#context.net.sendTo(
        state,
        sourcePeerId,
        "JOIN_ACCEPTED",
        { events },
      );
      this.#context.net.broadcast(
        state,
        "SYNC_STATE",
        { events },
        new Set([sourcePeerId]),
      );
      await this.#sync.connectRequiredPeers();
      return;
    }
    if (!this.#context.preConnection.canAcceptParticipant(state)) {
      this.#reject(sourcePeerId, "table is not accepting participants");
      return;
    }
    if (message.payload.participantId === state.hostId) {
      this.#reject(sourcePeerId, "participantId is already reserved");
      return;
    }
    const participant = this.#context.preConnection.createParticipant({
      participantId: message.payload.participantId,
      peerId: sourcePeerId,
      ...(message.payload.displayName === undefined
        ? {}
        : { displayName: message.payload.displayName }),
    });
    let seat;
    try {
      seat = this.#context.preConnection.selectAvailableSeat(state, participant);
    } catch {
      this.#reject(sourcePeerId, "no seat available");
      return;
    }
    const ordered = orderEventSpecs({
      state,
      actorId: state.hostId,
      specs: [membershipEventSpec({ participant, seatId: seat })],
      plugin: this.#context.plugin,
      idFactory: this.#context.idFactory,
    });
    if (!ordered.ok) {
      this.#reject(sourcePeerId, ordered.error);
      return;
    }
    await this.#sync.applyEvents(
      ordered.value.events,
      this.#context.localParticipant.peerId,
    );
    this.#context.net.broadcast(
      this.#context.state.getState(),
      "ORDERED_EVENTS",
      { events: ordered.value.events },
      new Set([sourcePeerId]),
      ordered.value.events[0]?.gameId,
    );
    this.#context.net.sendTo(
      this.#context.state.getState(),
      sourcePeerId,
      "JOIN_ACCEPTED",
      { events: this.#context.state.getHistory() },
    );
    await this.#sync.connectRequiredPeers();
  }

  #reject(peerId: PeerId, reason: string): void {
    this.#context.net.sendTo(
      this.#context.state.getState(),
      peerId,
      "JOIN_REJECTED",
      { reason },
    );
  }
}
