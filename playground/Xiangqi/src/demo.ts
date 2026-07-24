import type { GameEvent, GameStateSnapshot, IGamePlugin } from "p2p-lockstep-kit-session";
import { XiangqiBoardView } from "./board-view.js";
import {
  buildXiangqiSnapshot,
  createXiangqiSessionPlugin,
  legalMovesFrom,
  sideForPlayer,
  type XiangqiPoint,
  type XiangqiSide,
} from "./xiangqi-game.js";

type RuntimeObserver = {
  onStateChange(snapshot: GameStateSnapshot): void;
  onConnectionChange?(connected: boolean): void;
  onGameEvent?(event: GameEvent): void;
  onError?(error: { message: string; context?: unknown }): void;
};

export type XiangqiRuntime = {
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

const samePoint = (a: XiangqiPoint, b: XiangqiPoint) =>
  a.file === b.file && a.rank === b.rank;

export const mountXiangqi = ({ mount, runtime }: { mount: HTMLElement; runtime: XiangqiRuntime }) => {
  const view = new XiangqiBoardView();
  let session = runtime.observer.getSnapshot() ?? defaultSnapshot;
  let selected: XiangqiPoint | null = null;

  runtime.setGamePlugin(createXiangqiSessionPlugin());
  mount.replaceChildren(view.element);

  const canMove = () => {
    const position = buildXiangqiSnapshot(session.history);
    return (
      session.connected &&
      session.localState === "turn" &&
      !session.pendingAction &&
      !session.outcome &&
      position.valid &&
      !position.winner
    );
  };

  const render = () => {
    const position = buildXiangqiSnapshot(session.history);
    const localSide = sideForPlayer("local", session.lastStart);
    const legal = selected ? legalMovesFrom(session.history, selected).map((move) => move.to) : [];
    view.render({
      snapshot: position,
      selected,
      legal,
      localSide,
      disabled: !canMove(),
      status: statusText(session, position, localSide),
    });
  };

  view.onSelect((point) => {
    if (!canMove()) return;
    const position = buildXiangqiSnapshot(session.history);
    const localSide = sideForPlayer("local", session.lastStart);
    const piece = position.board[point.rank]![point.file];

    if (!selected) {
      if (piece?.side === localSide && piece.side === position.sideToMove) selected = point;
      render();
      return;
    }

    if (piece?.side === localSide && piece.side === position.sideToMove) {
      selected = point;
      render();
      return;
    }

    const move = legalMovesFrom(session.history, selected).find((candidate) =>
      samePoint(candidate.to, point),
    );
    if (!move) {
      selected = null;
      render();
      return;
    }

    runtime.actions.move(move);
    selected = null;
  });

  const unsubscribe = runtime.observer.subscribe({
    onStateChange(next) {
      session = next;
      selected = null;
      render();
    },
  });

  render();

  return () => {
    unsubscribe();
    view.element.remove();
  };
};

const sideName = (side: XiangqiSide | null) =>
  side ? (side === "red" ? "Red" : "Black") : null;

const statusText = (
  session: GameStateSnapshot,
  position: ReturnType<typeof buildXiangqiSnapshot>,
  localSide: XiangqiSide | null,
) => {
  const side = localSide ? ` · You are ${sideName(localSide)}` : "";
  if (!position.valid) return `Position unavailable${side}`;
  if (session.outcome?.kind === "win") {
    const result = session.outcome.winner === "local" ? "You win" : "Peer wins";
    return `${session.outcome.reason === "resignation" ? `${result} by resignation` : result}${side}`;
  }
  if (position.winner) {
    return `${position.winner === localSide ? "Checkmate · You win" : "Checkmate · Peer wins"}${side}`;
  }
  if (session.pendingAction) return `${session.pendingAction} approval pending${side}`;
  if (session.localState === "syncing" || session.remoteState === "syncing") return `Syncing position${side}`;
  if (!session.connected) return `${localSide ? "Peer offline" : "Waiting for peer"}${side}`;
  if (session.localState === "turn") return `${position.check ? "Your general is in check" : "Your turn"}${side}`;
  if (session.localState === "remote_turn") return `${position.check ? "Peer general is in check" : "Peer turn"}${side}`;
  if (session.localState === "could_start") return "Both ready · You can start";
  if (session.localState === "ready") return "You are ready · Waiting for peer";
  return "Connect, ready up, then start";
};
