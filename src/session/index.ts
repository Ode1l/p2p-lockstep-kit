import { NetworkClient } from 'p2p-lockstep-kit-network';
import { CommandBus } from './commandBus';
import { State } from './state/state';
import { createNetClient } from './net';
import { initializeContext } from './context';
import { registerHandlers } from './handlers/busRegister.ts';
import {
  buildGameStateSnapshot,
  GameStateObserver,
  UINotificationAdapter,
} from './observer';
import { LocalActionsAPI } from './actions';

/**
 * Create a new game session with state management and networking
 * @param sid Protocol scope identifier shared by both peers (optional)
 * @param networkClient Custom network client (optional, creates default if not provided)
 * @returns Session manager with bus, state, observer, net, and send method
 *
 * @example
 * const session = createSession();
 * // UI automatically updates when state changes - no manual observer calls needed!
 * session.observer.subscribe(myUIObserver);
 * session.bus.emit('READY', undefined, 'local');
 * await session.net.connect(remotePeerId);
 */
export const createSession = (networkClient: NetworkClient, sid?: string) => {
  const bus = new CommandBus();
  const state = new State(null, null);
  const observer = new GameStateObserver();
  const net = createNetClient(networkClient, bus, null);

  // Connect State mutations to UI updates via adapter (plugin pattern)
  // This is the ONLY place where UI notifications are triggered
  const uiAdapter = new UINotificationAdapter(state, observer, () =>
    net.getIsConnected(),
  );
  state.subscribeStateObserver(uiAdapter);

  initializeContext(state, bus, net, sid);
  registerHandlers(bus);

  const actions = new LocalActionsAPI(bus);

  net.onConnectionChange((isConnected) => {
    observer.notifyConnectionChange(isConnected);
    observer.notifyStateChange(buildGameStateSnapshot(state, isConnected));
  });

  return {
    bus,
    state,
    observer,
    net,
    actions,
    send: net.send.bind(net),
  };
};

export * from './observer';
export type { ISessionActions } from './actions';
export type {
  GameOutcome,
  PendingAction,
  PendingActionId,
  PlayerLabel,
  TurnEntry,
} from './state/state';
export type { SessionEvent, SessionState } from './state/fsm';
