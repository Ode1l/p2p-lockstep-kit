import type { ParticipantId, SeatId } from "../ids";
import { createOrderedEvent } from "../state/createEvent";
import type {
  OrderedEvent,
  SessionEventSpec,
} from "../state/events";
import type { MultiGamePlugin } from "../plugin/types";
import type { CommandRequestPayload } from "../../utils/protocol/multisession";
import type { JsonValue } from "../../utils/serialization/json";
import { failure, success, type Result } from "../../utils/result";
import { reduceOrderedEvent } from "../state/reducer";
import type { MultiSessionState, Participant } from "../state/types";
import type { IdFactory } from "./idFactory";

export interface OrderedBatch<TGameState> {
  readonly events: readonly OrderedEvent[];
  readonly projectedState: MultiSessionState<TGameState>;
}

const gameContext = <TGameState>(
  state: MultiSessionState<TGameState>,
  actorId: ParticipantId,
) => ({
  hostPeerId: state.hostPeerId,
  gameId: state.gameId,
  actorId,
  participantCount: state.configuration.participantCount,
  participants: state.participants,
  seats: state.seats,
  state: state.game as TGameState,
  lastAppliedSeq: state.lastAppliedSeq,
});

export const commandEventSpecs = <
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TSnapshot extends JsonValue,
>(
  state: MultiSessionState<TGameState>,
  actorId: ParticipantId,
  request: CommandRequestPayload,
  plugin: MultiGamePlugin<TCommand, TEventPayload, TGameState, TSnapshot>,
): Result<readonly SessionEventSpec[]> => {
  if (!state.participants.has(actorId)) return failure("command actor is not a member");
  if (request.expectedSeq > state.lastAppliedSeq) {
    return failure("command sequence is ahead of the host");
  }
  if (state.phase === "offline" || state.phase === "syncing") {
    return failure("commands are disabled while offline or syncing");
  }
  if (state.phase === "protocol_error") return failure("session has a protocol error");

  const command = request.command;
  if (command.type === "SET_DISPLAY_NAME") {
    if (!["mesh_connecting", "seated", "ready"].includes(state.phase)) {
      return failure("display name can only be changed before play starts");
    }
    const displayName = command.displayName.trim();
    if (!displayName || displayName.length > 80) {
      return failure("displayName must be a non-empty string up to 80 characters");
    }
    return success([{
      type: "DISPLAY_NAME_CHANGED",
      payload: { participantId: actorId, displayName },
    }]);
  }
  if (command.type === "SET_READY") {
    if (
      !state.meshReady ||
      state.participants.size !== state.configuration.participantCount ||
      (state.phase !== "seated" && state.phase !== "ready")
    ) {
      return failure("complete seated mesh is required before ready");
    }
    return success([
      {
        type: "READY_CHANGED",
        payload: { participantId: actorId, ready: command.ready },
      },
    ]);
  }
  if (command.type === "START_GAME") {
    if (actorId !== state.hostId) return failure("only host can start");
    if (!state.meshReady) return failure("complete mesh is required before start");
    return success([{
      type: "GAME_STARTED",
      payload: plugin.createStartPayload?.({
        hostPeerId: state.hostPeerId,
        gameId: state.gameId,
        participantCount: state.configuration.participantCount,
        participants: state.participants,
        seats: state.seats,
      }) ?? {},
    }]);
  }
  if (command.type === "GAME_COMMAND") {
    if (state.phase !== "playing" || state.game === null) {
      return failure("game command is not allowed outside playing");
    }
    const parsed = plugin.parseCommand(command.data);
    if (!parsed.ok) return parsed;
    const context = gameContext(state, actorId);
    const valid = plugin.validateCommand(parsed.value, context);
    if (!valid.ok) return valid;
    const events = plugin.commandToEvents(parsed.value, context);
    if (events.length === 0) return failure("game command produced no events");
    return success(
      events.map((event) => ({
        type: "GAME_EVENT" as const,
        payload: { gameType: event.type, data: event.payload },
      })),
    );
  }
  if (command.type === "PROPOSE_RESTART") {
    if (!state.meshReady || !["playing", "ended"].includes(state.phase)) {
      return failure("restart proposal requires an online active table");
    }
    return success([
      {
        type: "RESTART_PROPOSED",
        payload: { proposalId: command.proposalId },
      },
    ]);
  }
  if (!state.meshReady) return failure("restart vote requires a complete mesh");
  return success([
    {
      type: "RESTART_VOTED",
      payload: {
        proposalId: command.proposalId,
        participantId: actorId,
        approve: command.approve,
      },
    },
  ]);
};

export const orderEventSpecs = <
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TSnapshot extends JsonValue,
>(input: {
  state: MultiSessionState<TGameState>;
  actorId: ParticipantId;
  specs: readonly SessionEventSpec[];
  plugin: MultiGamePlugin<TCommand, TEventPayload, TGameState, TSnapshot>;
  idFactory: IdFactory;
}): Result<OrderedBatch<TGameState>> => {
  let projected = input.state;
  const events: OrderedEvent[] = [];
  const queue = [...input.specs];
  let outcomeQueued = false;

  while (queue.length > 0) {
    const spec = queue.shift()!;
    const event = createOrderedEvent({
      eventId: input.idFactory.eventId(),
      hostPeerId: projected.hostPeerId,
      gameId: projected.gameId,
      seq: projected.lastAppliedSeq + 1,
      actorId:
        spec.type === "GAME_RESTARTED"
          ? projected.hostId
          : input.actorId,
      spec,
    });
    const reduced = reduceOrderedEvent(projected, event, input.plugin);
    if (!reduced.ok) return reduced;
    projected = reduced.value;
    events.push(event);

    if (spec.type === "GAME_EVENT" && projected.game !== null) {
      const outcome = input.plugin.getOutcome(projected.game);
      if (outcome && !outcomeQueued) {
        outcomeQueued = true;
        queue.push({ type: "GAME_ENDED", payload: { outcome } });
      }
    }
    if (
      spec.type === "RESTART_VOTED" &&
      projected.pendingRestart?.status === "accepted"
    ) {
      queue.push({
        type: "GAME_RESTARTED",
        payload: {
          proposalId: projected.pendingRestart.id,
          nextGameId: input.idFactory.gameId(),
        },
      });
    }
  }

  return success({ events, projectedState: projected });
};

export const membershipEventSpec = (input: {
  participant: Omit<Participant, "joinedAtSeq">;
  seatId: SeatId;
}): SessionEventSpec => ({
  type: "MEMBERSHIP_JOINED",
  payload: {
    participantId: input.participant.id,
    peerId: input.participant.peerId,
    seatId: input.seatId,
    ...(input.participant.displayName === undefined
      ? {}
      : { displayName: input.participant.displayName }),
  },
});
