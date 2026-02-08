export type MessageType =
  | "HELLO"
  | "REJOIN"
  | "REJOIN_OK"
  | "SYNC_REQUEST"
  | "SYNC_STATE"
  | "MOVE"
  | "MOVE_REJECT";

export type Envelope<T = unknown> = {
  type: MessageType;
  sid: string;
  from: string;
  seq: number;
  turn: number;
  stateHash?: string;
  payload?: T;
};

export type HelloPayload = {
  gameId: string;
};

export type MovePayload = {
  x: number;
  y: number;
  player: 1 | 2;
  turn: number;
  hashAfter: string;
};

export type RejectPayload = {
  reason: string;
  turn: number;
  hash: string;
};

export type RejoinPayload = {
  cacheHash: string;
  turn: number;
};

export type RejoinOkPayload = {
  canRestore: boolean;
};

export type SyncStatePayload = {
  state: unknown;
  stateHash: string;
};
