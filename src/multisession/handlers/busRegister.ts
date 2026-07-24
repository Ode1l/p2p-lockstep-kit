import type { CommandBus } from "../commandBus";
import type { SessionContext } from "../context";
import type { JsonValue } from "../../utils/serialization/json";
import type { CommandHandler } from "./command";
import type { MembershipHandler } from "./membership";
import type { ProtocolHandler } from "./protocol";
import type { SyncHandler } from "./sync";

export const registerHandlers = <
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
>(input: {
  bus: CommandBus;
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
  protocol: ProtocolHandler<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;
  sync: SyncHandler<TCommand, TEventPayload, TGameState, TGameSnapshot>;
}): void => {
  const { bus, context, command, membership, protocol, sync } = input;
  bus.register("JOIN", (event) => membership.join(event.options));
  bus.register("DISPLAY_NAME", (event) =>
    command.submit({
      type: "SET_DISPLAY_NAME",
      displayName: event.displayName,
    }),
  );
  bus.register("READY", (event) =>
    command.submit({ type: "SET_READY", ready: event.ready }),
  );
  bus.register("START", () => command.submit({ type: "START_GAME" }));
  bus.register("MOVE", (event) =>
    command.submit({ type: "GAME_COMMAND", data: event.data }),
  );
  bus.register("PROPOSE_RESTART", (event) =>
    command.submit({
      type: "PROPOSE_RESTART",
      proposalId: event.proposalId,
    }),
  );
  bus.register("VOTE_RESTART", (event) =>
    command.submit({
      type: "VOTE_RESTART",
      proposalId: event.proposalId,
      approve: event.approve,
    }),
  );
  bus.register("RESUME", () => sync.resumeConnections());
  bus.register("PRIVATE_MESSAGE", (event) => {
    const participant = context.participant(event.participantId);
    if (!participant) throw new Error("private-message target is not a member");
    if (context.net.getPeerState(participant.peerId) !== "connected") {
      throw new Error("private-message target is not connected");
    }
    context.net.sendTo(
      context.state.getState(),
      participant.peerId,
      "PRIVATE_MESSAGE",
      {
        data: event.data,
        ...(event.relatedEventId === undefined
          ? {}
          : { relatedEventId: event.relatedEventId }),
      },
    );
  });
  bus.register("PROTOCOL_MESSAGE", (event) =>
    protocol.handle(event.sourcePeerId, event.raw),
  );
  bus.register("PEER_STATE", (event) => {
    if (context.net.getPeerState(event.peerId) !== event.connection) return;
    const participant = context.participantForPeer(event.peerId);
    if (!participant) return;
    if (
      context.state.getState().connections.get(participant.id) ===
      event.connection
    ) {
      return;
    }
    context.state.updateConnection(participant.id, event.connection);
    sync.finishConnectionSyncIfReady();
    context.notify();
  });
};
