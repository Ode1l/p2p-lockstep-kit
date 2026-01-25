export type TransportState =
  // No channel is attached yet.
  | "idle"
  // Channel exists but is still negotiating.
  | "connecting"
  // Channel is ready to send/receive.
  | "open"
  // Channel is in the process of closing.
  | "closing"
  // Channel is fully closed.
  | "closed"
  // Channel is in an unexpected/broken state.
  | "error";

export type TransportEvents = {
  state: { state: TransportState };
  open: undefined;
  close: { reason?: string };
  error: { error: unknown };
  message: { data: string };
  // Debug/log stream so callers can react to transport internals.
  log: { message: string };
};

export type ITransport = {
  readonly state: TransportState;
  send(data: string): void;
  close(reason?: string): void;
};
