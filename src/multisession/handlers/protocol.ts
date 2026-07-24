import type { PeerId } from "../ids";
import type { SessionContext } from "../context";
import { parseProtocolMessage } from "../../utils/protocol/validation";
import type { JsonValue } from "../../utils/serialization/json";
import type { CommandHandler } from "./command";
import type { MembershipHandler } from "./membership";
import type { SyncHandler } from "./sync";

export class ProtocolHandler<
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
  readonly #command: CommandHandler<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  readonly #membership: MembershipHandler<
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
  constructor(input: {
    context: SessionContext<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >;
    command: CommandHandler<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >;
    membership: MembershipHandler<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >;
    sync: SyncHandler<TCommand, TEventPayload, TGameState, TGameSnapshot>;
  }) {
    this.#context = input.context;
    this.#command = input.command;
    this.#membership = input.membership;
    this.#sync = input.sync;
  }

  async handle(sourcePeerId: PeerId, raw: unknown): Promise<void> {
    const parsed = parseProtocolMessage(raw);
    if (!parsed.ok) {
      this.#fail("invalid_message", parsed.error, sourcePeerId);
      return;
    }
    const message = parsed.value;
    const state = this.#context.state.getState();
    if (message.senderPeerId !== sourcePeerId) {
      this.#fail(
        "invalid_message",
        "senderPeerId does not match transport source",
        sourcePeerId,
      );
      return;
    }
    if (message.hostPeerId !== state.hostPeerId) {
      this.#fail("wrong_scope", "message has wrong hostPeerId", sourcePeerId);
      return;
    }
    if (message.type === "JOIN_REQUEST") {
      await this.#membership.accept(sourcePeerId, message);
      return;
    }
    if (message.type === "JOIN_ACCEPTED") {
      if (sourcePeerId !== this.#context.hostPeerId) {
        this.#fail(
          "invalid_message",
          "join response is not from host",
          sourcePeerId,
        );
        return;
      }
      await this.#sync.restoreFromHostRecord(message.payload.events);
      return;
    }
    if (message.type === "JOIN_REJECTED") {
      this.#context.state.markInvited();
      this.#context.notify();
      return;
    }

    const sender = this.#context.participantForPeer(sourcePeerId);
    if (!sender || message.senderParticipantId !== sender.id) {
      this.#fail(
        "invalid_message",
        "sender is not bound to source peer",
        sourcePeerId,
      );
      return;
    }
    if (
      message.gameId !== this.#context.state.getState().gameId &&
      message.type !== "SYNC_STATE"
    ) {
      this.#fail("wrong_scope", "message has wrong gameId", sourcePeerId);
      return;
    }

    if (message.type === "COMMAND_REQUEST") {
      if (!this.#context.isHost) return;
      try {
        await this.#command.process(sender.id, message.payload);
      } catch (error) {
        this.#context.net.sendTo(
          this.#context.state.getState(),
          sourcePeerId,
          "PROTOCOL_ERROR",
          {
            code: "command_rejected",
            message:
              error instanceof Error ? error.message : "command rejected",
          },
        );
      }
      return;
    }
    if (message.type === "ORDERED_EVENTS") {
      if (sender.id !== this.#context.state.getState().hostId) {
        this.#fail(
          "invalid_event",
          "ordered events are not from host",
          sourcePeerId,
        );
        return;
      }
      await this.#sync.applyEvents(message.payload.events, sourcePeerId);
      await this.#sync.connectRequiredPeers();
      return;
    }
    if (message.type === "SYNC_REQUEST") {
      if (this.#context.isHost) {
        this.#context.net.sendTo(
          this.#context.state.getState(),
          sourcePeerId,
          "SYNC_STATE",
          { events: this.#context.state.getHistory() },
        );
      }
      return;
    }
    if (message.type === "SYNC_STATE") {
      if (sender.id !== this.#context.state.getState().hostId) {
        this.#fail(
          "invalid_message",
          "sync state is not from host",
          sourcePeerId,
        );
        return;
      }
      await this.#sync.restoreFromHostRecord(message.payload.events);
      return;
    }
    if (message.type === "PRIVATE_MESSAGE") {
      this.#context.observer.notifyPrivateMessage({
        fromParticipantId: sender.id,
        data: message.payload.data,
        ...(message.payload.relatedEventId === undefined
          ? {}
          : { relatedEventId: message.payload.relatedEventId }),
      });
    }
  }

  #fail(
    code: Parameters<SessionContext<TCommand, TEventPayload, TGameState, TGameSnapshot>["fail"]>[0]["code"],
    message: string,
    peerId: PeerId,
  ): void {
    this.#context.fail({ code, message, peerId });
  }
}
