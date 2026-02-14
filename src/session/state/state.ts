// Session State (state): owns game instance, render bridge, and cached snapshot history.
// Responsibilities:
// - Maintain session-local state (peerId, color, history, cache).
// - Render UI updates and feed context into the game.
// - Persist/restore snapshot cache for rejoin.
import type {
  GameMove,
  IGamePlugin,
  IGameSession,
  GameStatus,
  IRuleGuard,
  IRuleGuardResult,
  ShellUi,
} from "../../game/types";
import type { Logger, SyncStatePayload } from "../../utils";

type SessionStateHooks = {
  onReadyChange?: (ready: { self: boolean; peer: boolean }) => void;
  onMatchStart?: () => void;
  onMatchEnd?: () => void;
};

type CacheState = {
  updatedAt: number;
  snapshot: unknown;
  hash: string;
  turn: number;
  history: GameMove[];
  myColor: 1 | 2;
};

const cacheKey = (sid: string) => `p2p-lockstep-kit:match:${sid}`;

const loadCache = (sid: string): CacheState | null => {
  const raw = localStorage.getItem(cacheKey(sid));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CacheState;
  } catch {
    return null;
  }
};

const saveCache = (sid: string, cache: CacheState | null) => {
  if (!cache) {
    localStorage.removeItem(cacheKey(sid));
    return;
  }
  localStorage.setItem(cacheKey(sid), JSON.stringify(cache));
};

export const createSessionState = (
  options: {
    sid: string;
    plugin: IGamePlugin;
    ui: ShellUi;
    mount: HTMLElement;
    onLocalMove: (move: GameMove) => void;
    logger: Logger;
  },
  hooks: SessionStateHooks = {},
) => {
  const { sid, plugin, ui, mount, onLocalMove, logger } = options;
  const game: IGameSession = plugin.create({
    mount,
    onLocalMove,
    onLog: (message) => {
      logger.info(`[game] ${message}`);
      ui.log?.(`[game] ${message}`);
    },
  });
  const getWinner = game.isWin;

  let myColor: 1 | 2 | null = null;
  let connected = false;
  let peerId = "";
  let readySelf = false;
  let readyPeer = false;
  let started = false;
  let history: GameMove[] = [];
  let lastWinner: 0 | 1 | 2 = 0;
  let cache = loadCache(sid);
  const ruleGuard: IRuleGuard =
    game.getRuleGuard?.() ??
    ({
      canApplyMove: (move: GameMove, _status: GameStatus): IRuleGuardResult => {
        const ok = game.canApplyMove(move);
        return ok ? { ok: true } : { ok: false, reason: "invalid" };
      },
    } satisfies IRuleGuard);

  if (cache) {
    myColor = cache.myColor;
  }

  const getStatus = (): GameStatus => game.getStatus();

  const peer = {
    getId: () => peerId,
    setId: (next: string) => {
      peerId = next;
    },
  };

  const connectionState = {
    set: (next: boolean) => {
      connected = next;
    },
  };

  const player = {
    getMyColor: () => myColor,
    setMyColor: (next: 1 | 2 | null) => {
      myColor = next;
    },
  };

  const notifyReadyChange = () => {
    hooks.onReadyChange?.({ self: readySelf, peer: readyPeer });
  };

  const ready = {
    get: () => ({ self: readySelf, peer: readyPeer }),
    setSelf: (next: boolean) => {
      readySelf = next;
      notifyReadyChange();
    },
    setPeer: (next: boolean) => {
      readyPeer = next;
      notifyReadyChange();
    },
    clear: () => {
      readySelf = false;
      readyPeer = false;
      notifyReadyChange();
    },
  };

  const startedState = {
    set: (next: boolean) => {
      started = next;
    },
    is: () => started,
  };

  const hasCache = () => !!cache;

  const handleWinnerChange = (prevStatus?: GameStatus) => {
    const status = game.getStatus();
    const winner = getWinner ? getWinner(status) : status.winner;
    const prevWinner = prevStatus?.winner ?? lastWinner;
    if (winner !== 0 && prevWinner !== winner) {
      lastWinner = winner;
      ready.clear();
      startedState.set(false);
      ui.showWinner?.(winner);
      const label = winner === myColor ? "You win!" : "You lose.";
      logger.info(`[game] ${label}`);
      ui.log?.(`[game] ${label}`);
      hooks.onMatchEnd?.();
    }
  };

  const render = () => {
    const status = game.getStatus();
    ui.updatePanel({
      peerId,
      connected,
      gameTitle: plugin.title,
      readySelf,
      readyPeer,
      started,
      myColor,
      currentTurn: status.turn,
      currentPlayer: status.currentPlayer,
      hasCache: hasCache(),
    });
    game.setContext({ connected, myColor });
  };

  const persistCache = () => {
    if (!myColor) {
      return;
    }
    const status = getStatus();
    cache = {
      updatedAt: Date.now(),
      snapshot: game.getSnapshot(),
      hash: game.getHash(),
      turn: status.turn,
      history: history.slice(-10),
      myColor,
    };
    saveCache(sid, cache);
  };

  const resetMatch = () => {
    game.reset();
    history = [];
    lastWinner = 0;
    render();
    persistCache();
  };

  const resetToLobby = () => {
    clearCache();
    ready.clear();
    startedState.set(false);
    resetMatch();
    hooks.onMatchEnd?.();
  };

  const startMatch = (nextColor: 1 | 2) => {
    clearCache();
    startedState.set(true);
    ready.clear();
    player.setMyColor(nextColor);
    resetMatch();
    ui.showStart?.();
    hooks.onMatchStart?.();
  };

  const applySnapshot = (payload: SyncStatePayload) => {
    game.applySnapshot(payload.state);
    history = [];
    render();
    persistCache();
    hooks.onMatchStart?.();
  };

  const canRestore = (
    payload: { cacheHash: string; turn: number },
    resumeTTLms: number,
  ) =>
    !!(
      cache &&
      cache.hash === payload.cacheHash &&
      cache.turn === payload.turn &&
      Date.now() - cache.updatedAt <= resumeTTLms
    );

  const clearCache = () => {
    cache = null;
    saveCache(sid, null);
  };

  const getCacheMeta = () => ({
    cacheHash: cache?.hash ?? "",
    cacheTurn: cache?.turn ?? 0,
  });

  const pushHistory = (move: GameMove) => {
    history.push(move);
  };

  const popHistory = () => history.pop();
  const hasHistory = () => history.length > 0;
  const getHistoryLength = () => history.length;

  const applyMove = (move: GameMove) => {
    game.applyMove(move);
    pushHistory(move);
  };

  const finalizeMove = (prevStatus: GameStatus) => {
    handleWinnerChange(prevStatus);
    render();
    persistCache();
  };

  const rollbackLastMove = () => {
    const last = popHistory();
    if (!last) {
      return false;
    }
    game.undoMove(last);
    render();
    persistCache();
    return true;
  };

  const applyUndoCount = (count: 1 | 2) => {
    let remaining = count;
    while (remaining > 0) {
      const last = popHistory();
      if (!last) {
        return false;
      }
      game.undoMove(last);
      remaining -= 1;
    }
    render();
    persistCache();
    return true;
  };

  notifyReadyChange();

  return {
    game,
    ruleGuard,
    getStatus,
    peer,
    connectionState,
    player,
    ready,
    startedState,
    hasCache,
    handleWinnerChange,
    render,
    persistCache,
    resetMatch,
    applySnapshot,
    canRestore,
    clearCache,
    getCacheMeta,
    history: {
      has: hasHistory,
      length: getHistoryLength,
    },
    resetToLobby,
    startMatch,
    applyMove,
    finalizeMove,
    rollbackLastMove,
    applyUndoCount,
  };
};
