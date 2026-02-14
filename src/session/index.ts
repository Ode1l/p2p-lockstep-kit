// Session Facade: public exports for the session layer.
// Responsibilities:
// - Expose session APIs without leaking folder structure details.
export { createSessionController } from "./controller";
export { createSessionFlow } from "./flow";
export { createCommandBus } from "./commandRegistry";
export type { SessionOptions } from "./controller";
export type { NetAdapter } from "./net";
export type {
  IGamePlugin,
  IGameSession,
  IGameContext,
  GameMove,
  GameStatus,
  IRuleGuard,
  IRuleGuardResult,
  ShellUi,
} from "../game/types";
