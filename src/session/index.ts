// Session Facade: public exports for the session layer.
// Responsibilities:
// - Expose session APIs without leaking folder structure details.
export { createSessionController } from "./controller";
export { createSessionFlow } from "./flow";
export { createSessionSync } from "./sync/sync";
export type { SessionOptions } from "./controller";
export type { NetAdapter } from "./net";
export type {
  GamePlugin,
  GameInstance,
  GameContext,
  GameMove,
  GameStatus,
  ShellUi,
} from "./state/types";
