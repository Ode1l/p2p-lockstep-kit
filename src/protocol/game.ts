// demo game message protocol

export type GameMessageType = "GAME_ACTION" | "SYNC_REQUEST" | "SYNC_STATE";

export type GameEnvelope<T = unknown> = {
  type: GameMessageType;
  sid: string;
  from: string;
  seq: number;
  turn: number;
  stateHash?: string;
  payload: T;
};
