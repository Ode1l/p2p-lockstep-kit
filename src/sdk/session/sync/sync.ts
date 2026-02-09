import { createEnvelope, type NetAdapter } from "../net";
import type {
  GameEnvelope as Envelope,
  MovePayload,
  RejoinPayload,
  SyncStatePayload,
  HelloPayload,
  ReadyPayload,
  StartPayload,
  UndoPayload,
  RestartPayload,
  ApprovePayload,
  RejectPayload,
} from "../../protocol";
import type { GameMove, GameStatus, ShellUi } from "../state/types";
import { createShellRouter } from "./router";
import type { Logger } from "../../logger";

// Session Sync (sync): owns message-level sync, rejoin, and move consistency.
// Responsibilities:
// - Validate/apply local + remote moves and drive sync reconciliation.
// - Perform HELLO/REJOIN/SYNC flows on connection changes.
// - Translate envelopes into game state changes via router.
export type SessionSync = {
  handleLocalMove: (move: GameMove) => void;
  onMessage: (msg: Envelope) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  setReady: (ready?: boolean) => void;
  requestUndo: () => void;
  requestRestart: () => void;
  requestStart: () => void;
};

type SyncState = {
  game: {
    canApplyMove: (move: GameMove | MovePayload) => boolean;
    applyMove: (move: GameMove) => void;
    undoMove: (move: GameMove) => void;
    getHash: () => string;
    getSnapshot: () => unknown;
  };
  getStatus: () => GameStatus;
  getPeerId: () => string;
  getMyColor: () => 1 | 2 | null;
  setMyColor: (color: 1 | 2 | null) => void;
  setConnected: (connected: boolean) => void;
  getReady: () => { self: boolean; peer: boolean };
  setReadySelf: (ready: boolean) => void;
  setReadyPeer: (ready: boolean) => void;
  clearReady: () => void;
  areBothReady: () => boolean;
  setStarted: (started: boolean) => void;
  isStarted: () => boolean;
  hasCache: () => boolean;
  pushHistory: (move: GameMove) => void;
  popHistory: () => GameMove | undefined;
  hasHistory: () => boolean;
  getHistoryLength: () => number;
  handleWinnerChange: (prev?: GameStatus) => void;
  persistCache: () => void;
  resetMatch: () => void;
  render: () => void;
  applySnapshot: (payload: SyncStatePayload) => void;
  canRestore: (payload: RejoinPayload, ttlMs: number) => boolean;
  clearCache: () => void;
  getCacheMeta: () => { cacheHash: string; cacheTurn: number };
};

export const createSessionSync = (deps: {
  sid: string;
  net: NetAdapter;
  state: SyncState;
  ui: ShellUi;
  logger: Logger;
  resumeTTLms: number;
  onDisconnect: () => void;
}): SessionSync => {
  const { sid, net, state, ui, logger, resumeTTLms, onDisconnect } = deps;
  let connected = false;
  let seq = 1;
  let lastStartSenderColor: 1 | 2 | null = null;
  let pendingUndoCount: 1 | 2 | null = null;

  const requestSync = () => {
    // Ask peer for authoritative snapshot when local state is uncertain.
    if (!state.getPeerId()) {
      return;
    }
    const status = state.getStatus();
    const msg = createEnvelope("SYNC_REQUEST", sid, state.getPeerId(), seq++, status.turn);
    net.send(msg);
  };

  const sendSyncState = () => {
    // Send current snapshot + hash to peer to heal desync or rejoin.
    if (!state.getPeerId()) {
      return;
    }
    const payload: SyncStatePayload = {
      state: state.game.getSnapshot(),
      stateHash: state.game.getHash(),
    };
    const status = state.getStatus();
    const msg = createEnvelope(
      "SYNC_STATE",
      sid,
      state.getPeerId(),
      seq++,
      status.turn,
      payload,
      payload.stateHash,
    );
    net.send(msg);
  };

  const sendMove = (move: GameMove) => {
    // Send local move with hashAfter for remote validation.
    const payload: MovePayload = {
      x: move.x,
      y: move.y,
      player: move.player,
      turn: move.turn,
      hashAfter: state.game.getHash(),
    };
    const status = state.getStatus();
    const msg = createEnvelope(
      "MOVE",
      sid,
      state.getPeerId(),
      seq++,
      status.turn,
      payload,
      payload.hashAfter,
    );
    net.send(msg);
  };

  const rejectMove = (reason: string) => {
    // Reject invalid/mismatched move and provide hash for reconciliation.
    const status = state.getStatus();
    const payload: RejectPayload = {
      action: "move",
      reason,
      turn: status.turn,
      hash: state.game.getHash(),
    };
    const msg = createEnvelope(
      "REJECT",
      sid,
      state.getPeerId(),
      seq++,
      status.turn,
      payload,
      payload.hash,
    );
    net.send(msg);
  };

  const handleIncomingMove = (payload: MovePayload) => {
    // Apply remote move with hash validation; request sync on mismatch.
    if (!state.game.canApplyMove(payload)) {
      rejectMove("invalid");
      return;
    }
    const prevStatus = state.getStatus();
    const move: GameMove = {
      x: payload.x,
      y: payload.y,
      player: payload.player,
      turn: payload.turn,
    };
    state.game.applyMove(move);
    state.pushHistory(move);
    if (payload.hashAfter !== state.game.getHash()) {
      const last = state.popHistory() as GameMove;
      state.game.undoMove(last);
      state.render();
      rejectMove("hash-mismatch");
      state.persistCache();
      return;
    }
    state.handleWinnerChange(prevStatus);
    state.render();
    state.persistCache();
  };

  const handleRejoin = async (payload: RejoinPayload) => {
    // Rejoin handshake: allow resume only if hash/turn/TTL match + user approval.
    const canRestore = state.canRestore(payload, resumeTTLms);
    const status = state.getStatus();
    if (!canRestore) {
      const msg = createEnvelope(
        "REJECT",
        sid,
        state.getPeerId(),
        seq++,
        status.turn,
        { action: "rejoin", reason: "cache-mismatch" } satisfies RejectPayload,
      );
      net.send(msg);
      state.clearCache();
      state.clearReady();
      state.setStarted(false);
      state.resetMatch();
      state.render();
      return;
    }
    const approved = await (ui.promptRejoinApprove?.() ?? Promise.resolve(false));
    const msg = createEnvelope(
      approved ? "APPROVE" : "REJECT",
      sid,
      state.getPeerId(),
      seq++,
      status.turn,
      approved
        ? ({ action: "rejoin" } satisfies ApprovePayload)
        : ({ action: "rejoin", reason: "rejected" } satisfies RejectPayload),
    );
    net.send(msg);
    if (approved) {
      state.setStarted(true);
      state.clearReady();
    } else {
      state.clearCache();
      state.clearReady();
      state.setStarted(false);
      state.resetMatch();
    }
    state.render();
  };

  const maybeSendRejoin = () => {
    // Proactively attempt cache-based resume when a peer connects.
    if (!state.getPeerId() || !state.hasCache()) {
      return;
    }
    const { cacheHash, cacheTurn } = state.getCacheMeta();
    const payload: RejoinPayload = {
      cacheHash,
      turn: cacheTurn,
    };
    const status = state.getStatus();
    const msg = createEnvelope("REJOIN", sid, state.getPeerId(), seq++, status.turn, payload);
    net.send(msg);
  };

  const maybePromptRejoinChoice = async () => {
    if (!state.hasCache()) {
      return;
    }
    const choice = await (ui.promptRejoinChoice?.() ?? Promise.resolve("restart"));
    if (choice === "restart") {
      state.clearCache();
      state.clearReady();
      state.setStarted(false);
      state.resetMatch();
      state.render();
      return;
    }
    maybeSendRejoin();
  };

  const handleHello = (payload: HelloPayload) => {
    if (payload?.gameId && payload.gameId !== sid) {
      logger.warn("[shell] game mismatch, disconnecting", payload.gameId);
      onDisconnect();
    }
  };

  const handleReady = (payload: ReadyPayload) => {
    state.setReadyPeer(payload.ready);
    if (payload.ready && state.getReady().self) {
      state.setReadySelf(false);
    }
    state.setStarted(false);
    if (state.areBothReady()) {
      // start is gated by explicit START message
    }
    state.render();
  };

  const handleStart = (payload: StartPayload) => {
    lastStartSenderColor = payload.senderColor;
    state.clearCache();
    state.setStarted(true);
    state.clearReady();
    state.setMyColor(payload.receiverColor);
    state.resetMatch();
    ui.showStart?.();
    state.render();
  };

  const applyUndo = (count: 1 | 2) => {
    let remaining = count;
    while (remaining > 0) {
      const last = state.popHistory();
      if (!last) {
        return false;
      }
      state.game.undoMove(last);
      remaining -= 1;
    }
    state.render();
    state.persistCache();
    return true;
  };

  const handleUndo = async (payload: UndoPayload) => {
    if (!state.isStarted()) {
      const msg = createEnvelope("REJECT", sid, state.getPeerId(), seq++, payload.turn, {
        action: "undo",
        reason: "not-started",
        turn: payload.turn,
        hash: state.game.getHash(),
      } satisfies RejectPayload);
      net.send(msg);
      return;
    }
    if (payload.count === 2 && state.getHistoryLength() < 2) {
      const msg = createEnvelope("REJECT", sid, state.getPeerId(), seq++, payload.turn, {
        action: "undo",
        reason: "no-history",
        turn: payload.turn,
        hash: state.game.getHash(),
      } satisfies RejectPayload);
      net.send(msg);
      return;
    }
    const approved = await (ui.promptUndo?.() ?? Promise.resolve(false));
    const status = state.getStatus();
    const msg = createEnvelope(
      approved ? "APPROVE" : "REJECT",
      sid,
      state.getPeerId(),
      seq++,
      status.turn,
      approved
        ? ({ action: "undo" } satisfies ApprovePayload)
        : ({
            action: "undo",
            reason: "rejected",
            turn: payload.turn,
            hash: state.game.getHash(),
          } satisfies RejectPayload),
    );
    net.send(msg);
    if (approved) {
      applyUndo(payload.count);
    }
  };

  const handleRestart = async (payload: RestartPayload) => {
    const approved = await (ui.promptRestart?.() ?? Promise.resolve(false));
    const status = state.getStatus();
    const msg = createEnvelope(
      approved ? "APPROVE" : "REJECT",
      sid,
      state.getPeerId(),
      seq++,
      status.turn,
      approved
        ? ({ action: "restart" } satisfies ApprovePayload)
        : ({
            action: "restart",
            reason: "rejected",
            turn: payload.turn,
            hash: state.game.getHash(),
          } satisfies RejectPayload),
    );
    net.send(msg);
    if (approved) {
      state.clearCache();
      state.clearReady();
      state.setStarted(false);
      state.resetMatch();
    }
  };

  const handleApprove = (payload: ApprovePayload) => {
    if (payload.action === "undo") {
      if (pendingUndoCount) {
        applyUndo(pendingUndoCount);
        pendingUndoCount = null;
      }
    }
    if (payload.action === "rejoin") {
      logger.info("[shell] restoring cached state");
      sendSyncState();
      state.setStarted(true);
      state.clearReady();
      return;
    }
    if (payload.action === "restart") {
      state.clearCache();
      state.clearReady();
      state.setStarted(false);
      state.resetMatch();
      return;
    }
  };

  const handleReject = (payload: RejectPayload) => {
    if (payload.action === "undo") {
      ui.showNotice?.("Undo rejected");
      pendingUndoCount = null;
      return;
    }
    if (payload.action === "rejoin") {
      logger.info("[shell] fresh pairing");
      state.clearCache();
      state.clearReady();
      state.setStarted(false);
      state.resetMatch();
      state.render();
      return;
    }
    if (payload.action === "restart") {
      ui.showNotice?.("Restart rejected");
      return;
    }
    if (payload.action === "move") {
      logger.warn("[shell] move rejected", payload.reason);
      const status = state.getStatus();
      const turnDiff = status.turn - (payload.turn ?? 0);
      if (turnDiff === 1) {
        const last = state.popHistory();
        if (!last) {
          requestSync();
          return;
        }
        state.game.undoMove(last);
        state.render();
        state.persistCache();
        if (state.game.getHash() !== payload.hash) {
          logger.warn("[shell] reject hash mismatch, requesting sync");
          requestSync();
        }
      } else {
        logger.warn("[shell] reject mismatch, requesting sync");
        requestSync();
      }
    }
  };

  const router = createShellRouter({
    sid,
    onHello: handleHello,
    onReady: handleReady,
    onStart: handleStart,
    onUndo: handleUndo,
    onRestart: handleRestart,
    onApprove: handleApprove,
    onReject: handleReject,
    onRejoin: handleRejoin,
    onMove: handleIncomingMove,
    onSyncRequest: sendSyncState,
    onSyncState: state.applySnapshot,
    afterHandle: state.render,
  });

  const handleLocalMove = (move: GameMove) => {
    if (!state.isStarted()) {
      return;
    }
    if (!state.getPeerId() || !state.getMyColor()) {
      return;
    }
    if (!state.game.canApplyMove(move)) {
      return;
    }
    const status = state.getStatus();
    if (status.winner !== 0 || status.currentPlayer !== state.getMyColor()) {
      return;
    }
    state.game.applyMove(move);
    state.pushHistory(move);
    state.handleWinnerChange(status);
    state.render();
    state.persistCache();
    sendMove(move);
  };

  const onConnectionState = (connState: RTCPeerConnectionState) => {
    const nowConnected = connState === "connected";
    if (nowConnected && !connected) {
      connected = true;
      state.setConnected(true);
      state.clearReady();
      state.setStarted(false);
      logger.info("[shell] datachannel connected");
      ui.log?.("[shell] datachannel connected");
      const statusNow = state.getStatus();
      const helloMsg = createEnvelope(
        "HELLO",
        sid,
        state.getPeerId(),
        seq++,
        statusNow.turn,
        { gameId: sid },
      );
      net.send(helloMsg);
      void maybePromptRejoinChoice();
    }
    if (!nowConnected && connected) {
      connected = false;
      state.setConnected(false);
      state.clearReady();
      state.setStarted(false);
      logger.info("[shell] datachannel disconnected");
      ui.log?.("[shell] datachannel disconnected");
    }
    state.render();
  };

  return {
    handleLocalMove,
    onMessage: (msg) => {
      void router.handleMessage(msg);
    },
    onConnectionState,
    setReady: (ready = true) => {
      if (!state.getPeerId()) {
        return;
      }
      state.setReadySelf(ready);
      state.setStarted(false);
      const payload: ReadyPayload = { ready };
      const status = state.getStatus();
      const msg = createEnvelope("READY", sid, state.getPeerId(), seq++, status.turn, payload);
      net.send(msg);
      state.render();
    },
    requestUndo: () => {
      if (!state.getPeerId() || !state.isStarted() || !state.hasHistory()) {
        return;
      }
      const status = state.getStatus();
      const myColor = state.getMyColor();
      const count: 1 | 2 =
        myColor && status.currentPlayer === myColor ? 2 : 1;
      if (count === 2 && state.getHistoryLength() < 2) {
        return;
      }
      pendingUndoCount = count;
      const payload: UndoPayload = {
        turn: status.turn,
        hash: state.game.getHash(),
        count,
      };
      const msg = createEnvelope("UNDO", sid, state.getPeerId(), seq++, status.turn, payload);
      net.send(msg);
    },
    requestRestart: () => {
      if (!state.getPeerId()) {
        return;
      }
      const status = state.getStatus();
      const payload: RestartPayload = {
        turn: status.turn,
        hash: state.game.getHash(),
      };
      const msg = createEnvelope("RESTART", sid, state.getPeerId(), seq++, status.turn, payload);
      net.send(msg);
    },
    requestStart: () => {
      if (!state.getPeerId()) {
        return;
      }
      if (!state.getReady().peer) {
        return;
      }
      const senderColor = lastStartSenderColor ? (lastStartSenderColor === 1 ? 2 : 1) : Math.random() < 0.5 ? 1 : 2;
      const receiverColor = senderColor === 1 ? 2 : 1;
      lastStartSenderColor = senderColor;
      const payload: StartPayload = {
        senderColor,
        receiverColor,
        firstPlayer: 1,
      };
      const status = state.getStatus();
      const msg = createEnvelope("START", sid, state.getPeerId(), seq++, status.turn, payload);
      net.send(msg);
      state.clearCache();
      state.setStarted(true);
      state.clearReady();
      state.setMyColor(senderColor);
      state.resetMatch();
      ui.showStart?.();
      state.render();
    },
  };
};
