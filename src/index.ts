export { createClient } from "./network";
export type { Facade } from "./network";

export { createShell } from "./ui/shell";
export type {
  IGamePlugin,
  IGameSession,
  IGameContext,
  GameMove,
  GameStatus,
  IRuleGuard,
  IRuleGuardResult,
  ShellUi,
} from "./ui/shell";
export { createShellUi } from "./ui/shell/ui/shellUi";
export { createDesktopShellUi } from "./ui/desktopShell";
