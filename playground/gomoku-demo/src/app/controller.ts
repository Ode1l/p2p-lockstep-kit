import {
  BOARD_SIZE,
  applyMove,
  canPlace,
  cloneState,
  createInitialState,
  resetState,
  undoMove,
  type GameState,
  type Move,
} from "../game/state";
import { createEnvelope, type NetClient } from "../net/client";
import type {
  Envelope,
  MovePayload,
  RejectPayload,
  RejoinOkPayload,
  RejoinPayload,
  StartPayload,
  SyncStatePayload,
} from "../net/protocol";

type CacheState = {
  updatedAt: number;
  state: GameState;
  history: Move[];
  gameIndex: number;
  myColor: 1 | 2;
  blackIsCaller: boolean;
};

type PanelInfo = {
  peerId: string;
  connected: boolean;
  myColor: 1 | 2 | null;
  turnLabel: string;
  hash: string;
  canReady: boolean;
  canUndo: boolean;
  canRestart: boolean;
  readyMe: boolean;
  readyPeer: boolean;
  gameStarted: boolean;
};

type Ui = {
  renderBoard: (
    state: GameState,
    hover: { x: number; y: number } | null,
    ghost: 1 | 2 | null,
  ) => void;
  updatePanel: (info: PanelInfo) => void;
  log: (message: string) => void;
  confirmUndo: () => Promise<boolean>;
  showResult: (message: string) => void;
  hideResult: () => void;
  showRestoreChoice: () => Promise<"restart" | "restore" | "cancel">;
  showRestartRequest: () => Promise<boolean>;
};

const CACHE_KEY = "gomoku-cache-v1";
const SID = "gomoku-demo";

const loadCache = (): CacheState | null => {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as CacheState;
    if (!data || data.state?.board?.length !== BOARD_SIZE) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const saveCache = (cache: CacheState | null) => {
  if (!cache) {
    localStorage.removeItem(CACHE_KEY);
    return;
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};

export const createController = (net: NetClient, ui: Ui) => {
  let peerId = "";
  let isCaller = false;
  let connected = false;
  let readyMe = false;
  let readyPeer = false;
  let myColor: 1 | 2 | null = null;
  let gameIndex = 0;
  let blackIsCaller = true;
  let seq = 1;
  let history: Move[] = [];
  let cache = loadCache();
  let resumeTTLms = 300000;
  let hoverCell: { x: number; y: number } | null = null;
  let lastWinner: 0 | 1 | 2 = 0;
  let gameStarted = false;

  const state = createInitialState();
  if (cache) {
    myColor = cache.myColor;
    gameIndex = cache.gameIndex;
    blackIsCaller = cache.blackIsCaller;
  }

  const render = () => {
    const ghost =
      connected && myColor === state.currentPlayer && state.winner === 0 ? myColor : null;
    ui.renderBoard(state, hoverCell, ghost);
    ui.updatePanel({
      peerId,
      connected,
      myColor,
      turnLabel: state.winner
        ? `Winner: ${state.winner === 1 ? "Black" : "White"}`
        : `Turn ${state.turn} (${state.currentPlayer === 1 ? "Black" : "White"})`,
      hash: state.hash,
      canReady: connected,
      canUndo: connected && history.length > 0,
      canRestart: connected,
      readyMe,
      readyPeer,
      gameStarted,
    });
  };

  const persistCache = () => {
    if (!myColor) {
      return;
    }
    cache = {
      updatedAt: Date.now(),
      state: cloneState(state),
      history: history.slice(-10),
      gameIndex,
      myColor,
      blackIsCaller,
    };
    saveCache(cache);
  };

  const resetMatch = (started: boolean) => {
    resetState(state);
    history = [];
    lastWinner = 0;
    gameStarted = started;
    ui.hideResult();
    render();
    persistCache();
  };

  const requestSync = () => {
    if (!peerId) {
      return;
    }
    const msg = createEnvelope("SYNC_REQUEST", peerId, seq++, state.turn);
    net.send(msg);
  };

  const sendSyncState = () => {
    if (!peerId) {
      return;
    }
    const payload: SyncStatePayload = {
      state: cloneState(state),
      stateHash: state.hash,
    };
    const msg = createEnvelope("SYNC_STATE", peerId, seq++, state.turn, payload, state.hash);
    net.send(msg);
  };

  const applySnapshot = (payload: SyncStatePayload) => {
    const snapshot = payload.state as GameState;
    state.board = snapshot.board;
    state.turn = snapshot.turn;
    state.currentPlayer = snapshot.currentPlayer;
    state.winner = snapshot.winner;
    state.lastMove = snapshot.lastMove;
    state.hash = payload.stateHash;
    history = [];
    render();
    persistCache();
  };

  const sendMove = (move: Move) => {
    const payload: MovePayload = {
      x: move.x,
      y: move.y,
      player: move.player,
      turn: move.turn,
      hashAfter: state.hash,
    };
    const msg = createEnvelope("MOVE", peerId, seq++, state.turn, payload, state.hash);
    net.send(msg);
  };

  const rejectMove = (reason: string) => {
    const payload: RejectPayload = {
      reason,
      turn: state.turn,
      hash: state.hash,
    };
    const msg = createEnvelope("MOVE_REJECT", peerId, seq++, state.turn, payload, state.hash);
    net.send(msg);
  };

  const handleIncomingMove = (payload: MovePayload) => {
    if (
      state.winner !== 0 ||
      payload.turn !== state.turn ||
      payload.player !== state.currentPlayer ||
      !canPlace(state, payload.x, payload.y)
    ) {
      rejectMove("invalid");
      return;
    }
    const move: Move = {
      x: payload.x,
      y: payload.y,
      player: payload.player,
      turn: payload.turn,
    };
    applyMove(state, move);
    history.push(move);
    if (payload.hashAfter !== state.hash) {
      const last = history.pop() as Move;
      undoMove(state, last);
      render();
      rejectMove("hash-mismatch");
      persistCache();
      return;
    }
    if (state.winner !== 0 && lastWinner !== state.winner) {
      lastWinner = state.winner;
      ui.showResult(state.winner === myColor ? "You win!" : "You lose.");
    }
    render();
    persistCache();
  };

  const handleUndo = () => {
    const last = history.pop();
    if (!last) {
      return;
    }
    undoMove(state, last);
    render();
    persistCache();
  };

  const handleStart = (payload: StartPayload) => {
    gameIndex = payload.gameIndex;
    blackIsCaller = payload.blackIsCaller;
    myColor = blackIsCaller ? (isCaller ? 1 : 2) : isCaller ? 2 : 1;
    resetMatch(true);
    readyMe = false;
    readyPeer = false;
    ui.log(`Game started. You are ${myColor === 1 ? "Black" : "White"}.`);
  };

  const sendReady = () => {
    const payload = { ready: true };
    const msg = createEnvelope("READY", peerId, seq++, state.turn, payload);
    net.send(msg);
  };

  const sendStart = () => {
    if (gameIndex === 0) {
      blackIsCaller = Math.random() > 0.5;
    } else {
      blackIsCaller = !blackIsCaller;
    }
    const payload: StartPayload = { gameIndex: gameIndex + 1, blackIsCaller };
    const msg = createEnvelope("START", peerId, seq++, state.turn, payload);
    net.send(msg);
    handleStart(payload);
  };

  const requestRestart = () => {
    if (!peerId) {
      return;
    }
    const msg = createEnvelope("RESTART_REQUEST", peerId, seq++, state.turn);
    net.send(msg);
    ui.log("Restart request sent.");
  };

  const acceptRestart = () => {
    resetMatch(false);
    readyMe = false;
    readyPeer = false;
    ui.log("Restart accepted. Press Ready to start.");
  };

  const handleRejoin = (payload: RejoinPayload) => {
    const canRestore =
      cache &&
      cache.state.hash === payload.cacheHash &&
      cache.state.turn === payload.turn &&
      Date.now() - cache.updatedAt <= resumeTTLms;
    const reply: RejoinOkPayload = { canRestore: !!canRestore };
    const msg = createEnvelope("REJOIN_OK", peerId, seq++, state.turn, reply);
    net.send(msg);
    if (!canRestore) {
      cache = null;
      saveCache(null);
    }
    render();
  };

  const handleRejoinOk = async (payload: RejoinOkPayload) => {
    if (payload.canRestore) {
      const choice = await ui.showRestoreChoice();
      if (choice === "restore") {
        ui.log("Restoring cached state.");
        sendSyncState();
      } else if (choice === "restart") {
        ui.log("Restarting with peer.");
        requestRestart();
      } else {
        ui.log("Restore canceled.");
      }
    } else {
      ui.log("Fresh pairing.");
      resetMatch(false);
    }
    render();
  };

  const maybeSendRejoin = () => {
    if (!peerId) {
      return;
    }
    const cacheHash = cache?.state?.hash ?? "";
    const cacheTurn = cache?.state?.turn ?? 0;
    const payload: RejoinPayload = {
      cacheHash,
      turn: cacheTurn,
    };
    const msg = createEnvelope("REJOIN", peerId, seq++, state.turn, payload);
    net.send(msg);
  };

  const handleMessage = async (msg: Envelope) => {
    if (msg.sid !== SID) {
      return;
    }
    switch (msg.type) {
      case "REJOIN":
        handleRejoin(msg.payload as RejoinPayload);
        break;
      case "REJOIN_OK":
        await handleRejoinOk(msg.payload as RejoinOkPayload);
        break;
      case "READY":
        readyPeer = true;
        if (readyMe && isCaller) {
          sendStart();
        }
        break;
      case "START":
        handleStart(msg.payload as StartPayload);
        break;
      case "MOVE":
        handleIncomingMove(msg.payload as MovePayload);
        break;
      case "MOVE_REJECT":
        {
          const payload = msg.payload as RejectPayload;
          ui.log(`Move rejected: ${payload.reason}`);
          const turnDiff = state.turn - payload.turn;
          if (turnDiff === 1 && history.length > 0) {
            const last = history.pop() as Move;
            undoMove(state, last);
            render();
            persistCache();
            if (state.hash !== payload.hash) {
              ui.log("Reject hash mismatch, requesting sync.");
              requestSync();
            }
          } else {
            ui.log("Reject mismatch, requesting sync.");
            requestSync();
          }
        }
        break;
      case "UNDO_REQUEST": {
        const allow = await ui.confirmUndo();
        if (allow) {
          const msgOut = createEnvelope("UNDO_ACCEPT", peerId, seq++, state.turn);
          net.send(msgOut);
          handleUndo();
        } else {
          const msgOut = createEnvelope("UNDO_REJECT", peerId, seq++, state.turn);
          net.send(msgOut);
        }
        break;
      }
      case "UNDO_ACCEPT":
        handleUndo();
        break;
      case "RESTART_REQUEST": {
        const allow = await ui.showRestartRequest();
        if (allow) {
          const msgOut = createEnvelope("RESTART_ACCEPT", peerId, seq++, state.turn);
          net.send(msgOut);
          acceptRestart();
        } else {
          const msgOut = createEnvelope("RESTART_REJECT", peerId, seq++, state.turn);
          net.send(msgOut);
        }
        break;
      }
      case "RESTART_ACCEPT":
        acceptRestart();
        break;
      case "RESTART_REJECT":
        ui.log("Restart rejected.");
        break;
      case "SYNC_REQUEST":
        sendSyncState();
        break;
      case "SYNC_STATE":
        applySnapshot(msg.payload as SyncStatePayload);
        break;
      default:
        break;
    }
    render();
  };

  const onRegister = async (url: string) => {
    const result = await net.register(url);
    peerId = result.peerId;
    ui.log(`Registered as ${peerId}`);
    render();
  };

  const onConnect = async (targetId: string) => {
    if (!targetId) {
      return;
    }
    isCaller = true;
    await net.connect(targetId);
    ui.log(`Connecting to ${targetId}`);
  };

  const onReady = () => {
    if (!connected) {
      return;
    }
    readyMe = true;
    sendReady();
    ui.hideResult();
    if (readyPeer && isCaller) {
      sendStart();
    }
  };

  const onUndo = () => {
    const msg = createEnvelope("UNDO_REQUEST", peerId, seq++, state.turn);
    net.send(msg);
  };

  const onRestart = () => {
    requestRestart();
  };

  const onDisconnect = () => {
    net.disconnect();
    connected = false;
    ui.log("Disconnected.");
    render();
  };

  const onResumeTtlChange = (ms: number) => {
    resumeTTLms = ms;
  };

  const onBoardHover = (cell: { x: number; y: number } | null) => {
    hoverCell = cell;
    render();
  };

  const onBoardClick = (cell: { x: number; y: number }) => {
    if (!connected || !myColor || state.winner !== 0) {
      return;
    }
    if (state.currentPlayer !== myColor) {
      return;
    }
    if (!canPlace(state, cell.x, cell.y)) {
      return;
    }
    const move: Move = { x: cell.x, y: cell.y, player: myColor, turn: state.turn };
    applyMove(state, move);
    history.push(move);
    if (state.winner !== 0 && lastWinner !== state.winner) {
      lastWinner = state.winner;
      ui.showResult(state.winner === myColor ? "You win!" : "You lose.");
    }
    render();
    persistCache();
    sendMove(move);
  };

  const start = (options?: { autoRegisterUrl?: string; autoConnectId?: string }) => {
    net.onMessage((msg) => {
      void handleMessage(msg);
    });
    if (options?.autoRegisterUrl) {
      void onRegister(options.autoRegisterUrl).then(() => {
        if (options.autoConnectId) {
          void onConnect(options.autoConnectId);
        }
      });
    }
    window.setInterval(() => {
      const status = net.state();
      const nowConnected = status.connectionState === "connected";
      if (nowConnected && !connected) {
        connected = true;
        ui.log("DataChannel connected.");
        maybeSendRejoin();
      }
      if (!nowConnected && connected) {
        connected = false;
        ui.log("DataChannel disconnected.");
      }
      render();
    }, 500);
    render();
  };

  return {
    start,
    onRegister,
    onConnect,
    onReady,
    onUndo,
    onRestart,
    onDisconnect,
    onResumeTtlChange,
    onBoardHover,
    onBoardClick,
  };
};
