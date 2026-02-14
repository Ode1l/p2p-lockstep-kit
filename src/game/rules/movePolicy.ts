import type { GameMove, GameStatus, IRuleGuardResult } from "../types";

type MovePolicyDeps = {
  getStatus: () => GameStatus;
  isStarted: () => boolean;
  hasPeer: () => boolean;
  getMyColor: () => 1 | 2 | null;
  canApplyByRule: (move: GameMove, status: GameStatus) => IRuleGuardResult;
  onLocalRejected: (reason?: string) => void;
};

type MoveValidationResult = { ok: true } | { ok: false; reason: string };

const reject = (reason: string): MoveValidationResult => ({ ok: false, reason });

export const createMovePolicy = (deps: MovePolicyDeps) => {
  const runRule = (move: GameMove): MoveValidationResult => {
    const status = deps.getStatus();
    const result = deps.canApplyByRule(move, status);
    if (!result.ok) {
      return reject(result.reason ?? "invalid");
    }
    return { ok: true };
  };

  const validateLocalMove = (move: GameMove): MoveValidationResult => {
    if (!deps.isStarted()) {
      return reject("not-started");
    }
    if (!deps.hasPeer()) {
      return reject("no-peer");
    }
    const myColor = deps.getMyColor();
    if (!myColor) {
      return reject("no-color");
    }
    if (move.player !== myColor) {
      return reject("player-mismatch");
    }
    const result = runRule(move);
    if (!result.ok) {
      deps.onLocalRejected(result.reason);
    }
    return result;
  };

  const validateRemoteMove = (move: GameMove): MoveValidationResult => {
    if (!deps.isStarted()) {
      return reject("not-started");
    }
    return runRule(move);
  };

  return {
    validateLocalMove,
    validateRemoteMove,
  };
};
