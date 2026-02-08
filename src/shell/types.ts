export type PlayerId = 1 | 2;
export type WinnerId = 0 | 1 | 2;

export type GameMove = {
  x: number;
  y: number;
  player: PlayerId;
  turn: number;
};

export type GameStatus = {
  turn: number;
  currentPlayer: PlayerId;
  winner: WinnerId;
};

export type GameContext = {
  mount: HTMLElement;
  onLocalMove: (move: GameMove) => void;
  onLog: (message: string) => void;
};

export type GameInstance = {
  dispose: () => void;
  reset: () => void;
  setContext: (info: { connected: boolean; myColor: PlayerId | null }) => void;
  getStatus: () => GameStatus;
  getHash: () => string;
  canApplyMove: (move: GameMove) => boolean;
  applyMove: (move: GameMove) => void;
  undoMove: (move: GameMove) => void;
  getSnapshot: () => unknown;
  applySnapshot: (snapshot: unknown) => void;
};

export type GamePlugin = {
  id: string;
  title: string;
  create: (ctx: GameContext) => GameInstance;
};

export type ShellUi = {
  updatePanel: (info: {
    peerId: string;
    connected: boolean;
    gameTitle: string;
  }) => void;
};
