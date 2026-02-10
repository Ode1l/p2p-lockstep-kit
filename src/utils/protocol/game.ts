// Game protocol messages (demo + shell control)

export type GameMessageType =
  | "HELLO"
  | "READY"
  | "START"
  | "UNDO"
  | "RESTART"
  | "APPROVE"
  | "REJECT"
  | "REJOIN"
  | "SYNC_REQUEST"
  | "SYNC_STATE"
  | "MOVE";

export type GameEnvelope<T = unknown> = {
  type: GameMessageType;
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

export type ReadyPayload = {
  ready: boolean;
};

export type StartPayload = {
  senderColor: 1 | 2;
  receiverColor: 1 | 2;
  firstPlayer: 1 | 2;
};

export type UndoPayload = {
  turn: number;
  hash: string;
  count: 1 | 2;
};

export type RestartPayload = {
  turn: number;
  hash: string;
};

export type ApprovePayload = {
  action: "undo" | "rejoin" | "restart";
  data?: unknown;
};

export type RejectPayload = {
  action: "move" | "undo" | "rejoin" | "restart";
  reason?: string;
  turn?: number;
  hash?: string;
};

export type MovePayload = {
  x: number;
  y: number;
  player: 1 | 2;
  turn: number;
  hashAfter: string;
};

export type RejoinPayload = {
  cacheHash: string;
  turn: number;
};

export type SyncStatePayload = {
  state: unknown;
  stateHash: string;
};
