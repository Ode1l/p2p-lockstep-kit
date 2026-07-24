import type { ParticipantId, PeerId, ProposalId } from "./ids";
import type { JsonValue } from "../utils/serialization/json";
import type { PeerConnectionState } from "./state/types";
import type { JoinOptions } from "./api";

export type SessionBusCommand =
  | Readonly<{ type: "JOIN"; options: JoinOptions }>
  | Readonly<{ type: "DISPLAY_NAME"; displayName: string }>
  | Readonly<{ type: "READY"; ready: boolean }>
  | Readonly<{ type: "START" }>
  | Readonly<{ type: "MOVE"; data: JsonValue }>
  | Readonly<{ type: "PROPOSE_RESTART"; proposalId: ProposalId }>
  | Readonly<{
      type: "VOTE_RESTART";
      proposalId: ProposalId;
      approve: boolean;
    }>
  | Readonly<{ type: "RESUME" }>
  | Readonly<{
      type: "PRIVATE_MESSAGE";
      participantId: ParticipantId;
      data: JsonValue;
      relatedEventId?: string;
    }>
  | Readonly<{ type: "PROTOCOL_MESSAGE"; sourcePeerId: PeerId; raw: unknown }>
  | Readonly<{
      type: "PEER_STATE";
      peerId: PeerId;
      connection: PeerConnectionState;
    }>;

export type CommandListener<TCommand extends SessionBusCommand = SessionBusCommand> = (
  command: TCommand,
) => Promise<void> | void;

type HandlerMap = Partial<{
  [TType in SessionBusCommand["type"]]: CommandListener<
    Extract<SessionBusCommand, { type: TType }>
  >;
}>;

export class CommandBus {
  readonly #handlers: HandlerMap = {};
  #processingQueue: Promise<void> = Promise.resolve();
  #disposed = false;

  register<TType extends SessionBusCommand["type"]>(
    type: TType,
    handler: CommandListener<Extract<SessionBusCommand, { type: TType }>>,
  ): void {
    if (this.#disposed) throw new Error("command bus is disposed");
    this.#handlers[type] = handler as HandlerMap[TType];
  }

  dispatch(command: SessionBusCommand): Promise<void> {
    if (this.#disposed) return Promise.reject(new Error("command bus is disposed"));
    const task = this.#processingQueue
      .catch(() => undefined)
      .then(async () => {
        const handler = this.#handlers[command.type] as
          | CommandListener
          | undefined;
        if (!handler) throw new Error(`no handler registered for ${command.type}`);
        await handler(command);
      });
    this.#processingQueue = task.catch(() => undefined);
    return task;
  }

  async idle(): Promise<void> {
    while (true) {
      const current = this.#processingQueue;
      await current;
      if (current === this.#processingQueue) return;
    }
  }

  dispose(): void {
    this.#disposed = true;
    for (const type of Object.keys(this.#handlers) as SessionBusCommand["type"][]) {
      delete this.#handlers[type];
    }
  }
}
