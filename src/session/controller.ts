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
import { createDefaultMiddlewares, createFsmGuardMiddleware } from "./commandMiddleware";
import { createMessageSender } from "./ports/sender.ts";
import { createNotifier } from "./ports/notifier";
import { createPendingState } from "./state/pending";
import type { PendingActionType } from "./state/pending";
import { createMoveHandlers } from "../game/handlers/move";
import { createReadyHandler } from "./handlers/ready";
import { createStartHandler } from "./handlers/start";
import { createUndoHandler } from "../game/handlers/undo";
import { createRestartHandler } from "./handlers/restart";
import { createApproveHandler } from "./handlers/approve";
import { createRejectHandler } from "./handlers/reject";
import { createRejoinHandler } from "./rejoin/handler";
import { createConnectionControl } from "./hooks/connection";
import { createRejoinChoiceControl } from "./rejoin/choice";
import { createSessionFsm } from "./state/fsm";
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

  const fsm = createSessionFsm({ logger });

  const state = createSessionState(
    {
      sid,
      plugin,
      ui,
      mount,
      logger,
      onLocalMove: (move) => {
        handleLocalMove?.(move);
      },
    },
    {
      onReadyChange: (ready) => fsm.onReadyStateChange(ready),
      onMatchStart: () => fsm.onMatchStart(),
      onMatchEnd: () => fsm.onMatchEnd(),
    },
  );

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
    fsm,
    messageSender,
    notifier,
    pending,
  };
  const pendingLabel: Record<PendingActionType, string> = {
    undo: "confirm undo",
    restart: "confirm restart",
    rejoin: "accept rejoin",
  };
  pending.onChange(({ phase, action, reason }) => {
    if (!ui.showNotice || !action) {
      return;
    }
    if (phase === "waiting") {
      ui.showNotice?.(`Waiting for opponent to ${pendingLabel[action]}`);
      return;
    }
    if (phase === "resolved") {
      ui.showNotice?.(`Opponent approved ${action}`);
      return;
    }
    if (phase === "rejected") {
      const label = reason ? `${action} rejected: ${reason}` : `${action} rejected`;
      ui.showNotice?.(label);
    }
  });
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
  const handleUndo = createUndoHandler(handlerDeps);
  const handleRestart = createRestartHandler(handlerDeps, {
    resetToLobby: state.resetToLobby,
  });
  const handleApprove = createApproveHandler(handlerDeps, {
    resetToLobby: state.resetToLobby,
  });
  const handleReject = createRejectHandler(handlerDeps, {
    resetToLobby: state.resetToLobby,
  });
  const handleRejoin = createRejoinHandler(handlerDeps, {
    resumeTTLms,
    resetToLobby: state.resetToLobby,
  });
  const maybePromptRejoinChoice = createRejoinChoiceControl(handlerDeps);
  const onConnectionState = createConnectionControl(handlerDeps, {
    maybePromptRejoinChoice,
  });
  const middlewares = [
    createFsmGuardMiddleware({
      fsm,
      logger,
      onLocalBlock: notifier.onRejectNotice,
    }),
    ...createDefaultMiddlewares(logger),
  ];

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
    middlewares,
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
    onReady: (ready?: boolean) => bus.emit("READY", { ready: ready ?? true }),
    onUndo: () => bus.emit("UNDO"),
    onRestart: () => bus.emit("RESTART"),
    onStart: () => bus.emit("START"),
  };
};
