export type MessageType =
  | "READY"
  | "START"
  | "UNDO_REQUEST"
  | "UNDO_ACCEPT"
  | "UNDO_REJECT"
  | "RESTART_REQUEST"
  | "RESTART_ACCEPT"
  | "RESTART_REJECT"
  | "RESULT"
  | "REJOIN"
  | "REJOIN_OK"
  | "SYNC_REQUEST"
  | "SYNC_STATE"
  | "MOVE"
  | "MOVE_REJECT";

export type Envelope<T = unknown> = {
  type: MessageType;
  sid: "gomoku-demo";
  from: string;
  seq: number;
  turn: number;
  stateHash?: string;
  payload?: T;
};

export type ReadyPayload = {
  ready: boolean;
};

export type StartPayload = {
  gameIndex: number;
  blackIsCaller: boolean;
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
