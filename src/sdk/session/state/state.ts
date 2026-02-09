// Session State (state): owns game instance, render bridge, and cached snapshot history.
// Responsibilities:
// - Maintain session-local state (peerId, color, history, cache).
// - Render UI updates and feed context into the game.
// - Persist/restore snapshot cache for rejoin.
import type { GameMove, GamePlugin, GameStatus, ShellUi } from "./types";
import type { Logger } from "../../logger";
import type { RejoinPayload, SyncStatePayload } from "../../protocol";

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

export const createSessionState = (options: {
  sid: string;
  plugin: GamePlugin;
  ui: ShellUi;
  mount: HTMLElement;
  onLocalMove: (move: GameMove) => void;
  logger: Logger;
}) => {
  const { sid, plugin, ui, mount, onLocalMove, logger } = options;
  const game = plugin.create({
    mount,
    onLocalMove,
    onLog: (message) => {
      logger.info(`[game] ${message}`);
      ui.log?.(`[game] ${message}`);
    },
  });

  let myColor: 1 | 2 | null = null;
  let connected = false;
  let peerId = "";
  let readySelf = false;
  let readyPeer = false;
  let started = false;
  let history: GameMove[] = [];
  let lastWinner: 0 | 1 | 2 = 0;
  let cache = loadCache(sid);

  if (cache) {
    myColor = cache.myColor;
  }

  const getStatus = (): GameStatus => game.getStatus();

  const setPeerId = (next: string) => {
    peerId = next;
  };

  const setConnected = (next: boolean) => {
    connected = next;
  };

  const setMyColor = (next: 1 | 2 | null) => {
    myColor = next;
  };

  const getMyColor = () => myColor;
  const getPeerId = () => peerId;
  const getReady = () => ({ self: readySelf, peer: readyPeer });
  const setReadySelf = (next: boolean) => {
    readySelf = next;
  };
  const setReadyPeer = (next: boolean) => {
    readyPeer = next;
  };
  const clearReady = () => {
    readySelf = false;
    readyPeer = false;
  };

  const setStarted = (next: boolean) => {
    started = next;
  };

  const isStarted = () => started;
  const areBothReady = () => readySelf && readyPeer;
  const hasCache = () => !!cache;


  const handleWinnerChange = (prevStatus?: GameStatus) => {
    const status = game.getStatus();
    const winner = game.isWin ? game.isWin(status) : status.winner;
    const prevWinner = prevStatus?.winner ?? lastWinner;
    if (winner !== 0 && prevWinner !== winner) {
      lastWinner = winner;
      clearReady();
      setStarted(false);
      ui.showWinner?.(winner);
      const label = winner === myColor ? "You win!" : "You lose.";
      logger.info(`[game] ${label}`);
      ui.log?.(`[game] ${label}`);
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

  const applySnapshot = (payload: SyncStatePayload) => {
    game.applySnapshot(payload.state);
    history = [];
    render();
    persistCache();
  };

  const canRestore = (payload: RejoinPayload, resumeTTLms: number) =>
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

  return {
    game,
    getStatus,
    setPeerId,
    setConnected,
    setMyColor,
    getMyColor,
    getPeerId,
    getReady,
    setReadySelf,
    setReadyPeer,
    clearReady,
    areBothReady,
    setStarted,
    isStarted,
    hasCache,
    handleWinnerChange,
    render,
    persistCache,
    resetMatch,
    applySnapshot,
    canRestore,
    clearCache,
    getCacheMeta,
    pushHistory,
    popHistory,
    hasHistory,
    getHistoryLength,
  };
};
