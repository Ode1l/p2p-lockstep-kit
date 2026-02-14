// Session Controller (core): composition root that wires flow + command registry + state.
// Responsibilities:
// - Build core session components and connect their boundaries.
// - Expose a minimal API to the shell layer.
import { createNetClient, type NetAdapter } from "./net";
import type { GameMove, IGamePlugin, ShellUi } from "../game/types";
import { createSessionState } from "./state/state";
import { createRegisterPolicy } from "./policy";
import { createSessionFlow } from "./flow";
import { consoleLogger, type Logger } from "../utils";
import { createCommandBus } from "./commandRegistry";
import { createDefaultMiddlewares } from "./commandMiddleware";
import { createMessageSender } from "./ports/messageSender";
import { createNotifier } from "./ports/notifier";
import { createPendingState } from "./pendingState";
import { createMoveHandlers } from "../game/handlers/move";
import { createReadyHandler } from "./handlers/ready";
import { createStartHandler } from "./handlers/start";
import { createUndoHandler } from "../game/handlers/undo";
import { createRestartHandler } from "./handlers/restart";
import { createApproveHandler } from "./handlers/approve";
import { createRejectHandler } from "./handlers/reject";
import { createRejoinHandler } from "./rejoin/handler";
import { createConnectionControl } from "./controls/connection";
import { createRejoinChoiceControl } from "./rejoin/choice";
import type { SessionDeps } from "./sessionTypes";

export type SessionOptions = {
  mount: HTMLElement;
  plugin: IGamePlugin;
  ui: ShellUi;
  sid?: string;
  resumeTTLms?: number;
  net?: NetAdapter;
  logger?: Logger;
  retry?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    multiplier?: number;
    jitter?: number;
    shouldRetry?: (error: unknown) => boolean;
  };
};

export const createSessionController = (options: SessionOptions) => {
  const { mount, plugin, ui } = options;
  const sid = options.sid ?? plugin.id;
  const resumeTTLms = options.resumeTTLms ?? 300000;
  const net = options.net ?? createNetClient();
  const logger = options.logger ?? consoleLogger;
  const pending = createPendingState();
  let seq = 1;
  let lastStartSenderColor: 1 | 2 | null = null;
  let handleLocalMove: ((move: GameMove) => void) | null = null;

  const state = createSessionState({
    sid,
    plugin,
    ui,
    mount,
    logger,
    onLocalMove: (move) => {
      handleLocalMove?.(move);
    },
  });

  const registerPolicy = createRegisterPolicy(options.retry);

  const messageSender = createMessageSender({
    sid,
    net,
    getStatus: state.getStatus,
    getPeerId: state.peer.getId,
    getHash: state.game.getHash,
    getSnapshot: state.game.getSnapshot,
    nextSeq: () => seq++,
  });
  const notifier = createNotifier({
    logger,
    showNotice: ui.showNotice,
    log: ui.log,
  });
  const handlerDeps: SessionDeps = {
    state,
    ui,
    messageSender,
    notifier,
  };
  const moveHandlers = createMoveHandlers(handlerDeps);
  const handleReady = createReadyHandler(handlerDeps);
  const handleStart = createStartHandler({
    startMatch: state.startMatch,
    setLastStartSenderColor: (color) => {
      lastStartSenderColor = color;
    },
    getLastStartSenderColor: () => lastStartSenderColor,
    canStart: () => !!state.peer.getId() && state.ready.get().peer,
    sendStart: (payload) => messageSender.sendStart(payload),
  });
  const handleUndo = createUndoHandler(handlerDeps, {
    setPendingAction: pending.setAction,
    setPendingUndoCount: pending.setUndoCount,
  });
  const handleRestart = createRestartHandler(handlerDeps, {
    resetToLobby: state.resetToLobby,
    setPendingAction: pending.setAction,
  });
  const handleApprove = createApproveHandler(handlerDeps, {
    getPendingAction: pending.getAction,
    setPendingAction: pending.setAction,
    getPendingUndoCount: pending.getUndoCount,
    setPendingUndoCount: pending.setUndoCount,
    resetToLobby: state.resetToLobby,
  });
  const handleReject = createRejectHandler(handlerDeps, {
    getPendingAction: pending.getAction,
    setPendingAction: pending.setAction,
    setPendingUndoCount: pending.setUndoCount,
    resetToLobby: state.resetToLobby,
  });
  const handleRejoin = createRejoinHandler(handlerDeps, {
    resumeTTLms,
    resetToLobby: state.resetToLobby,
  });
  const maybePromptRejoinChoice = createRejoinChoiceControl(handlerDeps, {
    setPendingAction: pending.setAction,
  });
  const onConnectionState = createConnectionControl(handlerDeps, {
    maybePromptRejoinChoice,
  });
  const bus = createCommandBus({
    sid,
    handlers: {
      READY: (payload, _meta, origin) => handleReady(payload as { ready: boolean }, origin),
      START: (payload, _meta, origin) =>
        handleStart(payload as { senderColor: 1 | 2; receiverColor: 1 | 2; firstPlayer: 1 | 2 }, origin),
      UNDO: (payload, _meta, origin) => handleUndo(payload as { count?: 1 | 2 }, origin),
      RESTART: (_payload, _meta, origin) => handleRestart(origin),
      APPROVE: () => handleApprove(),
      REJECT: (payload, meta) =>
        (payload as { action: "undo" | "rejoin" | "restart" | "move"; reason?: string })
          .action === "move"
          ? moveHandlers.handleMoveReject(
              payload as { action: "move"; reason?: string },
              meta,
            )
          : handleReject(payload as { action: "undo" | "rejoin" | "restart"; reason?: string }),
      REJOIN: (_payload, meta) => handleRejoin(meta),
      MOVE: (payload, meta, origin) =>
        moveHandlers.handleMove(
          payload as { x: number; y: number; player: 1 | 2 },
          meta,
          origin,
        ),
      SYNC_REQUEST: () => messageSender.sendSyncState(),
      SYNC_STATE: (payload) => state.applySnapshot(payload as { state: unknown }),
    },
    afterHandle: state.render,
    middlewares: createDefaultMiddlewares(logger),
  });
  handleLocalMove = (move) => {
    void bus.emit("MOVE", { x: move.x, y: move.y, player: move.player });
  };

  const flow = createSessionFlow({
    net,
    state,
    ui,
    logger,
    registerPolicy,
    shouldRetry: options.retry?.shouldRetry,
  });

  const start = (startOptions?: { autoRegisterUrl?: string; autoConnectId?: string }) => {
    net.onMessage((msg) => bus.handleMessage(msg));
    net.onConnectionState((connState) => onConnectionState(connState));
    flow.start(startOptions);
    state.render();
  };

  return {
    start,
    onRegister: flow.register,
    onConnect: flow.connect,
    onReady: (ready?: boolean) => {
      void bus.emit("READY", { ready: ready ?? true });
    },
    onUndo: () => {
      void bus.emit("UNDO");
    },
    onRestart: () => {
      void bus.emit("RESTART");
    },
    onStart: () => {
      void bus.emit("START");
    },
  };
};
