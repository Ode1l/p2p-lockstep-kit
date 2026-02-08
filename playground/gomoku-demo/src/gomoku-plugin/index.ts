import { BoardView } from "../ui/board";
import {
  applyMove,
  canPlace,
  cloneState,
  createInitialState,
  resetState,
  undoMove,
  type GameState,
} from "../game/state";
import type { GameInstance, GameMove, GamePlugin, GameStatus } from "../../../../src/shell";

export const gomokuPlugin: GamePlugin = {
  id: "gomoku-demo",
  title: "Gomoku",
  create: (ctx) => {
    const state = createInitialState();
    let connected = false;
    let myColor: 1 | 2 | null = null;
    let hoverCell: { x: number; y: number } | null = null;
    const boardView = new BoardView(520);

    ctx.mount.append(boardView.element);

    const render = () => {
      const ghost =
        connected && myColor === state.currentPlayer && state.winner === 0 ? myColor : null;
      boardView.render(state.board, hoverCell, ghost);
    };

    boardView.onHover((cell) => {
      hoverCell = cell;
      render();
    });

    boardView.onClick((cell) => {
      if (!connected || !myColor) {
        return;
      }
      if (state.winner !== 0 || state.currentPlayer !== myColor) {
        return;
      }
      if (!canPlace(state, cell.x, cell.y)) {
        return;
      }
      const move: GameMove = { x: cell.x, y: cell.y, player: myColor, turn: state.turn };
      ctx.onLocalMove(move);
    });

    const setContext = (info: { connected: boolean; myColor: 1 | 2 | null }) => {
      connected = info.connected;
      myColor = info.myColor;
      render();
    };

    const getStatus = (): GameStatus => ({
      turn: state.turn,
      currentPlayer: state.currentPlayer,
      winner: state.winner,
    });

    const canApplyMove = (move: GameMove) => {
      if (state.winner !== 0) {
        return false;
      }
      if (move.turn !== state.turn || move.player !== state.currentPlayer) {
        return false;
      }
      return canPlace(state, move.x, move.y);
    };

    const apply = (move: GameMove) => {
      applyMove(state, move);
      render();
    };

    const undo = (move: GameMove) => {
      undoMove(state, move);
      render();
    };

    const applySnapshot = (snapshot: unknown) => {
      const next = snapshot as GameState;
      state.board = next.board;
      state.turn = next.turn;
      state.currentPlayer = next.currentPlayer;
      state.winner = next.winner;
      state.lastMove = next.lastMove;
      state.hash = next.hash;
      render();
    };

    const reset = () => {
      resetState(state);
      render();
    };

    const dispose = () => {
      boardView.element.remove();
    };

    const instance: GameInstance = {
      dispose,
      reset,
      setContext,
      getStatus,
      getHash: () => state.hash,
      canApplyMove,
      applyMove: apply,
      undoMove: undo,
      getSnapshot: () => cloneState(state),
      applySnapshot,
    };

    render();
    return instance;
  },
};
