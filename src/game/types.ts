// Game Types: game adapter contracts and UI boundary types.
// Responsibilities:
// - Define game plugin interface and session UI boundary.
// Defaults: current session layer assumes 2-player turn-based games.
// If you need N-player, this type and the sync protocol must be redesigned.
export type PlayerId = 1 | 2;
export type WinnerId = 0 | 1 | 2;

export type GameMove = {
  x: number;
  y: number;
  player: PlayerId;
  turn: number;
};

export type IRuleGuardResult = {
  ok: boolean;
  reason?: string;
};

export type IRuleGuard = {
  canApplyMove: (move: GameMove, status: GameStatus) => IRuleGuardResult;
};

// Turn-based status for 2-player lockstep.
export type GameStatus = {
  turn: number;
  currentPlayer: PlayerId;
  winner: WinnerId;
};

export type IGameContext = {
  mount: HTMLElement;
  onLocalMove: (move: GameMove) => void;
  onLog: (message: string) => void;
};

export type IGameSession = {
  dispose: () => void;
  reset: () => void;
  setContext: (info: { connected: boolean; myColor: PlayerId | null }) => void;
  getStatus: () => GameStatus;
  isWin?: (status: GameStatus) => WinnerId;
  getHash: () => string;
  canApplyMove: (move: GameMove) => boolean;
  applyMove: (move: GameMove) => void;
  undoMove: (move: GameMove) => void;
  getSnapshot: () => unknown;
  applySnapshot: (snapshot: unknown) => void;
  getRuleGuard?: () => IRuleGuard;
};

export type IGamePlugin = {
  id: string;
  title: string;
  create: (ctx: IGameContext) => IGameSession;
};

export type GameAdapter = IGamePlugin;

export type ShellUi = {
  updatePanel: (info: {
    peerId: string;
    connected: boolean;
    gameTitle: string;
    readySelf: boolean;
    readyPeer: boolean;
    started: boolean;
    myColor: PlayerId | null;
    currentTurn: number;
    currentPlayer: PlayerId;
    hasCache: boolean;
  }) => void;
  log?: (message: string) => void;
  promptUndo?: () => Promise<boolean>;
  promptRestart?: () => Promise<boolean>;
  promptRejoinChoice?: () => Promise<"rejoin" | "restart">;
  promptRejoinApprove?: () => Promise<boolean>;
  showStart?: () => void;
  showWinner?: (winner: WinnerId) => void;
  showNotice?: (message: string) => void;
};
