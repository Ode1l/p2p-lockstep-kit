import type { GameEvent, GameStateSnapshot, IGamePlugin } from "p2p-lockstep-kit-session";
import { ChessBoardView } from "./board-view.js";
import {
  buildChessSnapshot,
  colorForPlayer,
  createChessMove,
  createChessSessionPlugin,
  legalMovesFrom,
  type ChessMove,
  type ChessPoint,
  type Promotion,
} from "./chess-game.js";

type RuntimeObserver = {
  onStateChange(snapshot: GameStateSnapshot): void;
  onConnectionChange?(connected: boolean): void;
  onGameEvent?(event: GameEvent): void;
  onError?(error: { message: string; context?: unknown }): void;
};

export type ChessRuntime = {
  setGamePlugin(plugin: IGamePlugin): void;
  actions: { move(data: unknown): void };
  observer: {
    subscribe(observer: RuntimeObserver): () => void;
    getSnapshot(): GameStateSnapshot | null;
  };
};

const defaultSnapshot: GameStateSnapshot = {
  localState: "idle",
  remoteState: "idle",
  turn: 1,
  history: [],
  lastStart: null,
  pendingAction: null,
  connected: false,
  outcome: null,
};

export const mountChess = ({ mount, runtime }: { mount: HTMLElement; runtime: ChessRuntime }) => {
  const view = new ChessBoardView();
  let session = runtime.observer.getSnapshot() ?? defaultSnapshot;
  let selected: ChessPoint | null = null;
  let promotionMove: ChessMove | null = null;

  runtime.setGamePlugin(createChessSessionPlugin());
  mount.replaceChildren(view.element);

  const canMove = () => {
    const position = buildChessSnapshot(session.history);
    return session.connected && session.localState === "turn" && !session.pendingAction && !session.outcome && position.valid && !position.checkmate;
  };

  const render = () => {
    const position = buildChessSnapshot(session.history);
    const localColor = colorForPlayer("local", session.lastStart);
    const legal = selected ? legalMovesFrom(session.history, selected).map((move) => move.to) : [];
    view.render({
      snapshot: position,
      selected,
      legal,
      localColor,
      disabled: !canMove(),
      status: statusText(session, position, localColor),
      promotionColor: promotionMove ? position.turn : null,
    });
  };

  view.onSelect((point) => {
    if (!canMove() || promotionMove) return;
    const position = buildChessSnapshot(session.history);
    const localColor = colorForPlayer("local", session.lastStart);
    const piece = position.board[point.rank]![point.file];

    if (!selected) {
      if (piece?.color === localColor && piece.color === position.turn) selected = point;
      render();
      return;
    }

    if (piece?.color === localColor && piece.color === position.turn) {
      selected = point;
      render();
      return;
    }

    const candidates = legalMovesFrom(session.history, selected).filter(
      (move) => move.to.file === point.file && move.to.rank === point.rank,
    );
    if (!candidates.length) {
      selected = null;
      render();
      return;
    }
    if (candidates.some((move) => move.promotion)) {
      promotionMove = createChessMove(selected, point);
      render();
      return;
    }
    runtime.actions.move(candidates[0]!);
    selected = null;
  });

  view.onPromote((promotion: Promotion) => {
    if (!promotionMove || !canMove()) return;
    runtime.actions.move(createChessMove(promotionMove.from, promotionMove.to, promotion));
    promotionMove = null;
    selected = null;
  });
  view.onCancelPromotion(() => {
    promotionMove = null;
    render();
  });

  const unsubscribe = runtime.observer.subscribe({
    onStateChange(next) {
      session = next;
      selected = null;
      promotionMove = null;
      render();
    },
  });
  render();
  return () => {
    unsubscribe();
    view.element.remove();
  };
};

const colorName = (color: "white" | "black" | null) =>
  color ? color[0]!.toUpperCase() + color.slice(1) : null;

const statusText = (
  session: GameStateSnapshot,
  position: ReturnType<typeof buildChessSnapshot>,
  localColor: "white" | "black" | null,
) => {
  const side = localColor ? ` · You are ${colorName(localColor)}` : "";
  if (!position.valid) return `Position unavailable${side}`;
  if (session.outcome?.kind === "draw") {
    return `${session.outcome.reason === "agreement" ? "Draw by agreement" : "Draw by mutual resignation"}${side}`;
  }
  if (session.outcome?.kind === "win") {
    const result = session.outcome.winner === "local" ? "You win" : "Peer wins";
    return `${session.outcome.reason === "resignation" ? `${result} by resignation` : result}${side}`;
  }
  if (position.checkmate) return `${position.winner === localColor ? "Checkmate · You win" : "Checkmate · Peer wins"}${side}`;
  if (position.stalemate) return `No legal moves${side}`;
  if (session.pendingAction) return `${session.pendingAction} approval pending${side}`;
  if (session.localState === "syncing" || session.remoteState === "syncing") return `Syncing position${side}`;
  if (!session.connected) return `${localColor ? "Peer offline" : "Waiting for peer"}${side}`;
  if (session.localState === "turn") return `${position.check ? "Your king is in check" : "Your turn"}${side}`;
  if (session.localState === "remote_turn") return `${position.check ? "Peer king is in check" : "Peer turn"}${side}`;
  if (session.localState === "could_start") return "Both ready · You can start";
  if (session.localState === "ready") return "You are ready · Waiting for peer";
  return "Connect, ready up, then start";
};
