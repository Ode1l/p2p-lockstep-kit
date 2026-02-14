import type { GameMove, GameStatus, IRuleGuard, IRuleGuardResult } from "../../../../src";

const createBaseGuard = (deps: { canApplyMove: (move: GameMove) => boolean }): IRuleGuard => ({
  canApplyMove: (move: GameMove, status: GameStatus): IRuleGuardResult => {
    if (status.winner !== 0) {
      return { ok: false, reason: "game-ended" };
    }
    if (move.turn !== status.turn || move.player !== status.currentPlayer) {
      return { ok: false, reason: "turn-mismatch" };
    }
    const ok = deps.canApplyMove(move);
    return ok ? { ok: true } : { ok: false, reason: "invalid" };
  },
});

const withLoggingProxy = (inner: IRuleGuard): IRuleGuard => ({
  canApplyMove: (move: GameMove, status: GameStatus): IRuleGuardResult => {
    const result = inner.canApplyMove(move, status);
    return result;
  },
});

export const createGomokuRuleGuard = (deps: { canApplyMove: (move: GameMove) => boolean }) =>
  withLoggingProxy(createBaseGuard(deps));
