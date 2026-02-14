export type GameMessageType = "MOVE";

export type MovePayload = {
  x: number;
  y: number;
  player: 1 | 2;
};
