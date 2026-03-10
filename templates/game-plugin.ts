import type {
  IGameContext,
  IGameSession,
  GameMove,
  IGamePlugin,
  GameStatus,
} from '../src';

export const examplePlugin: IGamePlugin = {
  id: "example-game",
  title: "Example Game",
  create: (ctx: IGameContext): IGameSession => {
    let connected = false;
    let myColor: 1 | 2 | null = null;
    const state = {
      turn: 1,
      currentPlayer: 1 as 1 | 2,
      winner: 0 as 0 | 1 | 2,
    };

    const setContext = (info: { connected: boolean; myColor: 1 | 2 | null }) => {
      connected = info.connected;
      myColor = info.myColor;
      void connected;
      void myColor;
    };

    const getStatus = (): GameStatus => ({
      turn: state.turn,
      currentPlayer: state.currentPlayer,
      winner: state.winner,
    });

    const getHash = () => `${state.turn}:${state.currentPlayer}:${state.winner}`;

    const canApplyMove = (_move: GameMove) => true;

    const applyMove = (_move: GameMove) => {
      state.turn += 1;
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    };

    const undoMove = (_move: GameMove) => {
      state.turn = Math.max(1, state.turn - 1);
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    };

    const getSnapshot = () => ({ ...state });

    const applySnapshot = (snapshot: unknown) => {
      const next = snapshot as typeof state;
      state.turn = next.turn;
      state.currentPlayer = next.currentPlayer;
      state.winner = next.winner;
    };

    const reset = () => {
      state.turn = 1;
      state.currentPlayer = 1;
      state.winner = 0;
    };

    const dispose = () => {
      ctx.mount.innerHTML = "";
    };

    return {
      dispose,
      reset,
      setContext,
      getStatus,
      getHash,
      canApplyMove,
      applyMove,
      undoMove,
      getSnapshot,
      applySnapshot,
    };
  },
};
