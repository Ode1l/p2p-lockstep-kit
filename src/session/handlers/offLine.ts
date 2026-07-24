import type { CommandListener } from '../commandBus';
import { getBus, getState } from '../context';
import { consoleLogger } from '../../utils';

/**
 * Handle connection state changes (OFFLINE/ONLINE)
 *
 * OFFLINE: Record current turn state before disconnecting
 * ONLINE: Trigger sync to restore game state after reconnect
 *
 * Flow:
 * 1. OFFLINE arrives -> save resumeTurn, transition to offline
 * 2. ONLINE arrives -> transition to syncing, emit SYNC_REQUEST
 * 3. sync handler takes over -> restore history and turn assignment
 */
export const offline: CommandListener = (command) => {
  if (command.type !== 'OFFLINE' && command.type !== 'ONLINE') {
    return;
  }

  const state = getState();
  const bus = getBus();
  consoleLogger.debug('[session:connection] received', {
    type: command.type,
    from: command.from,
    local: state.getState('local'),
    remote: state.getState('remote'),
    pending: state.getPendingAction(),
    resumeTurn: state.getResumeTurn(),
  });

  if (command.type === 'OFFLINE') {
    // A disconnect makes an in-flight approval unverifiable. Model this as
    // sync recovery: local waits in syncing, remote stays offline until ONLINE.
    if (state.hasPendingAction()) {
      const resumeTurn = state.getResumeTurn();

      if (state.canAction('local', 'SYNC')) {
        state.dispatch('local', 'SYNC', 'syncing');
      }
      state.clearPendingStates();
      state.setResumeTurn(resumeTurn);
    }

    // Peer disconnected - save current turn state for later recovery
    if (!state.canAction('remote', 'OFFLINE')) {
      console.warn('[Offline] Cannot transition to OFFLINE from current state');
      return;
    }

    // Record who had the turn before going offline
    const currentTurn =
      state.getResumeTurn() ??
      (state.getState('local') === 'turn' ? 'local' : 'remote');
    state.setResumeTurn(currentTurn);

    // Transition to offline state
    state.dispatch('remote', 'OFFLINE', 'offline');
    consoleLogger.debug('[session:connection] remote offline', { currentTurn });
    return;
  }

  // ONLINE only means "reconnected" if the session FSM was already offline.
  // Initial WebRTC connection is handled by the connection observer, not this
  // recovery path.
  if (state.getState('remote') !== 'offline') {
    consoleLogger.debug(
      '[session:connection] ignored online while remote is not offline',
      {
        remote: state.getState('remote'),
      },
    );
    return;
  }

  // ONLINE - peer reconnected
  if (!state.canAction('remote', 'ONLINE')) {
    console.warn('[Offline] Cannot transition to ONLINE from current state');
    return;
  }

  // Transition to syncing state
  state.dispatch('remote', 'ONLINE', 'syncing');

  // We kept the authoritative timeline while the peer was away, so push our
  // state to the reconnecting peer instead of asking it for a possibly empty one.
  bus.emit('SYNC_STATE', undefined, 'local');
  consoleLogger.debug('[session:connection] remote online, sync state pushed');
};
