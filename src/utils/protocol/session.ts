export type SessionMessageType =
  | "READY"
  | "START"
  | "UNDO"
  | "RESTART"
  | "APPROVE"
  | "REJECT"
  | "REJOIN"
  | "SYNC_REQUEST"
  | "SYNC_STATE";

export type ReadyPayload = {
  ready: boolean;
};

export type StartPayload = {
  senderColor: 1 | 2;
  receiverColor: 1 | 2;
  firstPlayer: 1 | 2;
};

export type UndoPayload = {
  count: 1 | 2;
};

export type RejectPayload = {
  action: "move" | "undo" | "rejoin" | "restart";
  reason?: string;
};

export type SyncStatePayload = {
  state: unknown;
};
