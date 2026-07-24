import { proposalId, type ParticipantId, type ProposalId } from "./ids";
import type { JsonValue } from "../utils/serialization/json";
import type { MultiSessionActions, JoinOptions } from "./api";
import type { CommandBus } from "./commandBus";
import { createRandomId } from "../utils/randomId";

export class LocalActionsAPI<TCommand extends JsonValue>
  implements MultiSessionActions<TCommand>
{
  readonly #bus: CommandBus;
  readonly join: MultiSessionActions<TCommand>["join"];
  readonly setDisplayName: MultiSessionActions<TCommand>["setDisplayName"];
  readonly ready: MultiSessionActions<TCommand>["ready"];
  readonly start: MultiSessionActions<TCommand>["start"];
  readonly move: MultiSessionActions<TCommand>["move"];
  readonly proposeRestart: MultiSessionActions<TCommand>["proposeRestart"];
  readonly voteRestart: MultiSessionActions<TCommand>["voteRestart"];
  readonly resume: MultiSessionActions<TCommand>["resume"];
  readonly sendPrivate: MultiSessionActions<TCommand>["sendPrivate"];

  constructor(bus: CommandBus) {
    this.#bus = bus;
    this.join = (options: JoinOptions = {}) =>
      this.#bus.dispatch({ type: "JOIN", options });
    this.setDisplayName = (displayName: string) =>
      this.#bus.dispatch({ type: "DISPLAY_NAME", displayName });
    this.ready = (ready = true) =>
      this.#bus.dispatch({ type: "READY", ready });
    this.start = () => this.#bus.dispatch({ type: "START" });
    this.move = (command: TCommand) =>
      this.#bus.dispatch({ type: "MOVE", data: command });
    this.proposeRestart = (
      id: ProposalId = proposalId(`proposal-${createRandomId()}`),
    ) => this.#bus.dispatch({ type: "PROPOSE_RESTART", proposalId: id });
    this.voteRestart = (id: ProposalId, approve: boolean) => this.#bus.dispatch({
      type: "VOTE_RESTART",
      proposalId: id,
      approve,
    });
    this.resume = () => this.#bus.dispatch({ type: "RESUME" });
    this.sendPrivate = (
      participantId: ParticipantId,
      data: JsonValue,
      relatedEventId?: string,
    ) => void this.#bus.dispatch({
      type: "PRIVATE_MESSAGE",
      participantId,
      data,
      ...(relatedEventId === undefined ? {} : { relatedEventId }),
    });
  }
}
