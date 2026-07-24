import type { State } from './state/state';
import type { CommandBus } from './commandBus';
import type { SessionMessage } from '../utils';
import { NetClient } from './net';

/**
 * Global session context holder
 * Stores the current session's dependencies for handler access
 * Used by handlers to retrieve state, bus, and network client
 */
class SessionContext {
  private readonly state: State;
  private readonly bus: CommandBus;
  private readonly net: NetClient;
  private readonly sid?: string;

  constructor(state: State, bus: CommandBus, net: NetClient, sid?: string) {
    this.state = state;
    this.bus = bus;
    this.net = net;
    this.sid = sid;
  }

  getState() {
    return this.state;
  }

  getBus() {
    return this.bus;
  }

  getNet() {
    return this.net;
  }

  getSid() {
    return this.sid;
  }
}

let instance: SessionContext | null = null;

/**
 * Initialize the global session context
 * Must be called before handlers use context getters
 * @throws Error if context is accessed before initialization
 */
export const initializeContext = (
  state: State,
  bus: CommandBus,
  net: NetClient,
  sid?: string,
) => {
  instance = new SessionContext(state, bus, net, sid);
};

/**
 * Reset the session context (for testing)
 * @internal Used by tests to clean up between test cases
 */
export const resetContext = () => {
  instance = null;
};

/**
 * Get the current session context
 * @throws Error if context has not been initialized
 * @internal Use getState(), getBus(), etc. instead
 */
const requireContext = () => {
  if (!instance) {
    throw new Error(
      '[SessionContext] Not initialized. Call initializeContext() first.',
    );
  }
  return instance;
};

/**
 * Get the current game state
 * @throws Error if context has not been initialized
 */
export const getState = () => requireContext().getState();

/**
 * Get the command bus
 * @throws Error if context has not been initialized
 */
export const getBus = () => requireContext().getBus();

/**
 * Get the network client
 * @throws Error if context has not been initialized
 * @internal Prefer using send() for sending messages
 */
export const getNet = () => requireContext().getNet();

/**
 * Get the session ID
 * @throws Error if context has not been initialized
 */
export const getSid = () => requireContext().getSid();

/**
 * Send a session message to the remote peer
 * @throws Error if context has not been initialized
 */
export const send = (message: SessionMessage) =>
  requireContext().getNet().send(message);

