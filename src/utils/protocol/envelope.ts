import type { GameMessageType } from "./game";
import type { SessionMessageType } from "./session";

export type MessageType = SessionMessageType | GameMessageType;
export type MessageDomain = "session" | "game";

export type WireEnvelope<T = unknown> = {
  domain?: MessageDomain;
  type: MessageType;
  from: string;
  seq: number;
  sid?: string;
  turn?: number;
  stateHash?: string;
  payload?: T;
};

const GAME_TYPES = new Set<MessageType>(["MOVE"]);

export const resolveMessageDomain = (msg: {
  type: MessageType;
  domain?: MessageDomain;
}): MessageDomain => {
  if (msg.domain) {
    return msg.domain;
  }
  return GAME_TYPES.has(msg.type) ? "game" : "session";
};
