import type {
  GameEvent,
  GameStateSnapshot,
  IGamePlugin,
} from "p2p-lockstep-kit-session";
import { GomokuBoardView } from "./board-view.js";
import {
  buildGomokuSnapshot,
  createGomokuSessionPlugin,
  createMove,
  type Cell,
} from "./game.js";

export type GomokuSessionSnapshot = GameStateSnapshot;
export type GomokuRuntimeEvent = GameEvent;

export type GomokuRuntimeObserver = {
  onStateChange(snapshot: GomokuSessionSnapshot): void;
  onConnectionChange?(connected: boolean): void;
  onGameEvent?(event: GomokuRuntimeEvent): void;
  onError?(error: { message: string; context?: unknown }): void;
};

export type GomokuRuntime = {
  setGamePlugin(plugin: IGamePlugin): void;
  actions: {
    move(data: unknown): void;
  };
  observer: {
    subscribe(observer: GomokuRuntimeObserver): () => void;
    getSnapshot(): GomokuSessionSnapshot | null;
  };
};

const defaultSnapshot: GomokuSessionSnapshot = {
  localState: "idle",
  remoteState: "idle",
  turn: 1,
  history: [],
  lastStart: null,
  pendingAction: null,
  connected: false,
};

export const mountGomokuDemo = (options: {
  mount: HTMLElement;
  runtime: GomokuRuntime;
}) => {
  const boardView = new GomokuBoardView();
  let snapshot = options.runtime.observer.getSnapshot() ?? defaultSnapshot;
  let hover: Cell | null = null;
  let dismissedWinnerKey: string | null = null;

  options.mount.replaceChildren(boardView.element);
  options.runtime.setGamePlugin(createGomokuSessionPlugin());

  const render = () => {
    const gomoku = buildGomokuSnapshot(snapshot.history);
    const canMove =
      snapshot.connected &&
      snapshot.localState === "turn" &&
      !snapshot.pendingAction &&
      !gomoku.winner;
    const ghost =
      canMove && hover && gomoku.board[hover.y][hover.x] === 0
        ? gomoku.nextStone
        : null;
    const winnerKey = gomoku.winningPlayer
      ? `${gomoku.winningPlayer}:${snapshot.history.length}`
      : null;

    if (!winnerKey) {
      dismissedWinnerKey = null;
    }

    boardView.render({
      board: gomoku.board,
      hover,
      ghost,
      lastMove: gomoku.lastMove,
      disabled: !canMove,
      status: getStatusText(snapshot, gomoku.winningPlayer, gomoku.nextStone),
      winnerNotice:
        winnerKey && dismissedWinnerKey !== winnerKey
          ? {
              title: gomoku.winningPlayer === "local" ? "You win" : "Peer wins",
              description: "Five in a row. Ready up to start the next match.",
            }
          : null,
    });
  };

  boardView.onDismissWinner(() => {
    const gomoku = buildGomokuSnapshot(snapshot.history);
    dismissedWinnerKey = gomoku.winningPlayer
      ? `${gomoku.winningPlayer}:${snapshot.history.length}`
      : null;
    render();
  });

  boardView.onHover((cell) => {
    hover = cell;
    render();
  });

  boardView.onMove((cell) => {
    const gomoku = buildGomokuSnapshot(snapshot.history);
    const canMove =
      snapshot.connected &&
      snapshot.localState === "turn" &&
      !snapshot.pendingAction &&
      !gomoku.winner &&
      gomoku.board[cell.y][cell.x] === 0;

    if (!canMove) {
      return;
    }

    hover = null;
    options.runtime.actions.move(createMove(cell));
  });

  const unsubscribe = options.runtime.observer.subscribe({
    onStateChange(next) {
      snapshot = next;
      render();
    },
    onConnectionChange() {},
    onGameEvent() {},
  });

  render();

  return () => {
    unsubscribe();
    boardView.element.remove();
  };
};

const stoneLabel = (stone: 1 | 2) => (stone === 1 ? "Black" : "White");

const localStone = (snapshot: GomokuSessionSnapshot): 1 | 2 | null => {
  if (snapshot.lastStart === "local") {
    return 1;
  }
  if (snapshot.lastStart === "remote") {
    return 2;
  }
  return null;
};

const withStone = (message: string, stone: 1 | 2 | null) =>
  stone ? `${message} · You are ${stoneLabel(stone)}` : message;

const getStatusText = (
  snapshot: GomokuSessionSnapshot,
  winner: "local" | "remote" | null,
  nextStone: 1 | 2,
) => {
  const mine = localStone(snapshot);
  if (winner) {
    return withStone(winner === "local" ? "You win" : "Peer wins", mine);
  }
  if (snapshot.pendingAction) {
    return withStone(`${snapshot.pendingAction} approval pending`, mine);
  }
  if (snapshot.localState === "syncing" || snapshot.remoteState === "syncing") {
    return withStone("Syncing board", mine);
  }
  if (!snapshot.connected) {
    return withStone(mine ? "Peer offline" : "Waiting for peer", mine);
  }
  if (snapshot.localState === "turn") {
    return withStone(`Your turn · ${stoneLabel(nextStone)} to move`, mine);
  }
  if (snapshot.localState === "remote_turn") {
    return withStone(`Peer turn · ${stoneLabel(nextStone)} to move`, mine);
  }
  if (snapshot.localState === "could_start") {
    return "Both ready · You can start";
  }
  if (snapshot.localState === "ready") {
    return "You are ready · Waiting for peer";
  }
  return "Connect, ready up, then start";
};
