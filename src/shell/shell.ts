import { createNetClient, createEnvelope } from "./net";
import type {
  Envelope,
  MovePayload,
  RejectPayload,
  RejoinOkPayload,
  RejoinPayload,
  SyncStatePayload,
} from "./protocol";
import type { GameMove, GamePlugin, GameStatus, ShellUi } from "./types";

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

export const createShell = (options: {
  mount: HTMLElement;
  plugin: GamePlugin;
  ui: ShellUi;
  sid?: string;
  resumeTTLms?: number;
}) => {
  const { mount, plugin, ui } = options;
  const sid = options.sid ?? plugin.id;
  const resumeTTLms = options.resumeTTLms ?? 300000;
  const net = createNetClient();

  let peerId = "";
  let isCaller = false;
  let connected = false;
  let myColor: 1 | 2 | null = null;
  let seq = 1;
  let history: GameMove[] = [];
  let cache = loadCache(sid);
  let lastWinner: 0 | 1 | 2 = 0;

  const game = plugin.create({
    mount,
    onLocalMove: (move) => {
      if (!connected || !myColor) {
        return;
      }
      const status = game.getStatus();
      if (status.winner !== 0 || status.currentPlayer !== myColor) {
        return;
      }
      if (!game.canApplyMove(move)) {
        return;
      }
      game.applyMove(move);
      history.push(move);
      handleWinnerChange(status);
      render();
      persistCache();
      sendMove(move);
    },
    onLog: (message) => console.log(`[game] ${message}`),
  });

  if (cache) {
    myColor = cache.myColor;
  }

  const getStatus = (): GameStatus => game.getStatus();

  const handleWinnerChange = (prevStatus?: GameStatus) => {
    const status = game.getStatus();
    const prevWinner = prevStatus?.winner ?? lastWinner;
    if (status.winner !== 0 && prevWinner !== status.winner) {
      lastWinner = status.winner;
      const label = status.winner === myColor ? "You win!" : "You lose.";
      console.log(`[game] ${label}`);
    }
  };

  const render = () => {
    const status = getStatus();
    ui.updatePanel({
      peerId,
      connected,
      gameTitle: plugin.title,
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

  const requestSync = () => {
    if (!peerId) {
      return;
    }
    const status = getStatus();
    const msg = createEnvelope("SYNC_REQUEST", sid, peerId, seq++, status.turn);
    net.send(msg);
  };

  const sendSyncState = () => {
    if (!peerId) {
      return;
    }
    const payload: SyncStatePayload = {
      state: game.getSnapshot(),
      stateHash: game.getHash(),
    };
    const status = getStatus();
    const msg = createEnvelope("SYNC_STATE", sid, peerId, seq++, status.turn, payload, payload.stateHash);
    net.send(msg);
  };

  const applySnapshot = (payload: SyncStatePayload) => {
    game.applySnapshot(payload.state);
    history = [];
    render();
    persistCache();
  };

  const sendMove = (move: GameMove) => {
    const payload: MovePayload = {
      x: move.x,
      y: move.y,
      player: move.player,
      turn: move.turn,
      hashAfter: game.getHash(),
    };
    const status = getStatus();
    const msg = createEnvelope("MOVE", sid, peerId, seq++, status.turn, payload, payload.hashAfter);
    net.send(msg);
  };

  const rejectMove = (reason: string) => {
    const status = getStatus();
    const payload: RejectPayload = {
      reason,
      turn: status.turn,
      hash: game.getHash(),
    };
    const msg = createEnvelope("MOVE_REJECT", sid, peerId, seq++, status.turn, payload, payload.hash);
    net.send(msg);
  };

  const handleIncomingMove = (payload: MovePayload) => {
    if (!game.canApplyMove(payload)) {
      rejectMove("invalid");
      return;
    }
    const prevStatus = getStatus();
    const move: GameMove = {
      x: payload.x,
      y: payload.y,
      player: payload.player,
      turn: payload.turn,
    };
    game.applyMove(move);
    history.push(move);
    if (payload.hashAfter !== game.getHash()) {
      const last = history.pop() as GameMove;
      game.undoMove(last);
      render();
      rejectMove("hash-mismatch");
      persistCache();
      return;
    }
    handleWinnerChange(prevStatus);
    render();
    persistCache();
  };

  const handleRejoin = (payload: RejoinPayload) => {
    const canRestore =
      cache &&
      cache.hash === payload.cacheHash &&
      cache.turn === payload.turn &&
      Date.now() - cache.updatedAt <= resumeTTLms;
    const reply: RejoinOkPayload = { canRestore: !!canRestore };
    const status = getStatus();
    const msg = createEnvelope("REJOIN_OK", sid, peerId, seq++, status.turn, reply);
    net.send(msg);
    if (!canRestore) {
      cache = null;
      saveCache(sid, null);
    }
    render();
  };

  const handleRejoinOk = async (payload: RejoinOkPayload) => {
    if (payload.canRestore) {
      console.log("[shell] Restoring cached state.");
      sendSyncState();
      return;
    }
    console.log("[shell] Fresh pairing.");
    resetMatch();
    render();
  };

  const maybeSendRejoin = () => {
    if (!peerId) {
      return;
    }
    const cacheHash = cache?.hash ?? "";
    const cacheTurn = cache?.turn ?? 0;
    const payload: RejoinPayload = {
      cacheHash,
      turn: cacheTurn,
    };
    const status = getStatus();
    const msg = createEnvelope("REJOIN", sid, peerId, seq++, status.turn, payload);
    net.send(msg);
  };

  const handleMessage = async (msg: Envelope) => {
    if (msg.sid !== sid) {
      return;
    }
    switch (msg.type) {
      case "HELLO": {
        const payload = msg.payload as { gameId?: string };
        if (payload?.gameId && payload.gameId !== sid) {
          console.log(`[shell] Game mismatch: remote is ${payload.gameId}. Disconnecting.`);
          onDisconnect();
        }
        break;
      }
      case "REJOIN":
        handleRejoin(msg.payload as RejoinPayload);
        break;
      case "REJOIN_OK":
        await handleRejoinOk(msg.payload as RejoinOkPayload);
        break;
      case "MOVE":
        handleIncomingMove(msg.payload as MovePayload);
        break;
      case "MOVE_REJECT": {
        const payload = msg.payload as RejectPayload;
        console.log(`[shell] Move rejected: ${payload.reason}`);
        const status = getStatus();
        const turnDiff = status.turn - payload.turn;
        if (turnDiff === 1 && history.length > 0) {
          const last = history.pop() as GameMove;
          game.undoMove(last);
          render();
          persistCache();
          if (game.getHash() !== payload.hash) {
            console.log("[shell] Reject hash mismatch, requesting sync.");
            requestSync();
          }
        } else {
          console.log("[shell] Reject mismatch, requesting sync.");
          requestSync();
        }
        break;
      }
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
    console.log(`[shell] Registered as ${peerId}`);
    render();
  };

  const onConnect = async (targetId: string) => {
    if (!targetId) {
      return;
    }
    isCaller = true;
    await net.connect(targetId);
    console.log(`[shell] Connecting to ${targetId}`);
  };

  const onDisconnect = () => {
    net.disconnect();
    connected = false;
    console.log("[shell] Disconnected.");
    render();
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
        console.log("[shell] DataChannel connected.");
        const statusNow = getStatus();
        const helloMsg = createEnvelope(
          "HELLO",
          sid,
          peerId,
          seq++,
          statusNow.turn,
          { gameId: sid },
        );
        net.send(helloMsg);
        myColor = isCaller ? 1 : 2;
        resetMatch();
        console.log(`[shell] Game started. You are ${myColor === 1 ? "Black" : "White"}.`);
        maybeSendRejoin();
      }
      if (!nowConnected && connected) {
        connected = false;
        console.log("[shell] DataChannel disconnected.");
      }
      render();
    }, 500);
    render();
  };

  return {
    start,
    onRegister,
    onConnect,
  };
};
