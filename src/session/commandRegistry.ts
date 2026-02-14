// Command Registry: dispatch envelopes to handlers by type.
import {
  resolveMessageDomain,
  type MessageType,
  type WireEnvelope as Envelope,
} from "../utils";

export type CommandOrigin = "local" | "remote";
export type CommandMeta = { turn?: number; stateHash?: string };

export type CommandHandlers = Partial<
  Record<
    MessageType,
    (payload: unknown, meta: CommandMeta, origin: CommandOrigin) => Promise<void> | void
  >
>;

export type CommandMiddleware = (args: {
  msg: Envelope;
  meta: CommandMeta;
  payload: unknown;
  origin: CommandOrigin;
}) => boolean | void | Promise<boolean | void>;

export const createCommandBus = (deps: {
  sid: string;
  handlers: CommandHandlers;
  afterHandle?: () => void;
  middlewares?: CommandMiddleware[];
}) => {
  const { sid, handlers, afterHandle, middlewares } = deps;

  const dispatch = async (
    origin: CommandOrigin,
    msg: Envelope,
    payload: unknown,
    meta: CommandMeta,
  ) => {
    const domain = resolveMessageDomain(msg);
    if (domain === "session" && msg.sid !== sid) {
      return;
    }
    const handler = handlers[msg.type as MessageType];
    if (handler) {
      if (middlewares && middlewares.length) {
        for (const middleware of middlewares) {
          const result = await middleware({ msg, meta, payload, origin });
          if (result === false) {
            return;
          }
        }
      }
      await handler(payload, meta, origin);
    }
    afterHandle?.();
  };

  const handleMessage = async (msg: Envelope) =>
    dispatch(
      "remote",
      msg,
      msg.payload ?? {},
      { turn: msg.turn, stateHash: msg.stateHash },
    );

  const emit = async (type: MessageType, payload?: unknown) =>
    {
      const domain = resolveMessageDomain({ type });
      return dispatch(
        "local",
        {
          type,
          domain,
          sid: domain === "session" ? sid : undefined,
          from: "",
          seq: 0,
          payload: payload ?? {},
        } as Envelope,
        payload ?? {},
        {},
      );
    };

  return { handleMessage, emit };
};
