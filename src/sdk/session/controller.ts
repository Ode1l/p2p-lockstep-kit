// Session Controller (core): composition root that wires flow + sync + state.
// Responsibilities:
// - Build core session components and connect their boundaries.
// - Expose a minimal API to the shell layer.
import { createNetClient, type NetAdapter } from "./net";
import type { GamePlugin, ShellUi } from "./state/types";
import { createSessionState } from "./state/state";
import { createRegisterPolicy } from "./policy";
import { createSessionSync } from "./sync/sync";
import { createSessionFlow } from "./flow";
import { consoleLogger, type Logger } from "../logger";

export type SessionOptions = {
  mount: HTMLElement;
  plugin: GamePlugin;
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
  let sync: ReturnType<typeof createSessionSync> | null = null;

  const state = createSessionState({
    sid,
    plugin,
    ui,
    mount,
    logger,
    onLocalMove: (move) => {
      sync?.handleLocalMove(move);
    },
  });

  const registerPolicy = createRegisterPolicy(options.retry);

  const handleDisconnect = () => {
    net.disconnect();
    state.setConnected(false);
    logger.info("[shell] disconnected");
    ui.log?.("[shell] disconnected");
    state.render();
  };

  sync = createSessionSync({
    sid,
    net,
    state,
    ui,
    logger,
    resumeTTLms,
    onDisconnect: handleDisconnect,
  });

  const flow = createSessionFlow({
    net,
    state,
    ui,
    logger,
    registerPolicy,
    shouldRetry: options.retry?.shouldRetry,
  });

  const start = (startOptions?: { autoRegisterUrl?: string; autoConnectId?: string }) => {
    net.onMessage((msg) => sync?.onMessage(msg));
    net.onConnectionState((connState) => sync?.onConnectionState(connState));
    flow.start(startOptions);
    state.render();
  };

  return {
    start,
    onRegister: flow.register,
    onConnect: flow.connect,
    onReady: (ready?: boolean) => sync?.setReady(ready),
    onUndo: () => sync?.requestUndo(),
    onRestart: () => sync?.requestRestart(),
    onStart: () => sync?.requestStart(),
  };
};
