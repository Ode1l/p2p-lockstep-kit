import type { CommandListener } from '../commandBus';
import { getBus, getState, send } from '../context';
import { consoleLogger } from '../../utils';

/**
 * Handle undo request from local or remote player
 *
 * Validates undo is legal (enough history, no pending action, valid state)
 * and initiates undo request with peer approval flow.
 *
 * Undo always rolls back the requester's last move:
 * - requester has just moved -> undo 1 ply
 * - requester has already received a reply -> undo 2 plies
 *
 * If the request is rejected, the game resumes from the pre-request turn.
 * Records pending undo state for approval/rejection handling by request handler.
 */
export const undo: CommandListener = (command) => {
  if (command.type !== 'UNDO') {
    return;
  }

  const state = getState();
  const bus = getBus();
  consoleLogger.debug('[session:undo] received', {
    from: command.from,
    local: state.getState('local'),
    remote: state.getState('remote'),
    pending: state.getPendingAction(),
    history: state.getHistory().length,
  });

  if (command.from === 'local') {
    // Validate no pending action
    if (state.hasPendingAction()) {
      return;
    }

    // Validate state transitions
    if (!state.canAction('local', 'UNDO')) {
      console.warn('[Undo] Cannot UNDO from current state');
      return;
    }

    // If it is our turn, our last move is two plies back. If it is the
    // peer's turn, our last move is the latest ply.
    const localState = state.getState('local');
    const undoCount = localState === 'turn' ? 2 : 1;
    const rejectResumePlayer = localState === 'turn' ? 'local' : 'remote';

    // Validate history is long enough
    if (state.getHistory().length < undoCount) {
      console.warn('[Undo] Not enough history to undo', { count: undoCount });
      return;
    }

    // Store the pre-request turn for REJECT. APPROVE uses requester ownership
    // in dispatchApprove(), then applies the history rollback.
    state.initializeUndoRequest(undoCount as 1 | 2, rejectResumePlayer);

    // Transition to approval waiting state
    state.dispatch('local', 'UNDO');
    state.dispatch('remote', 'REMOTE_UNDO');

    send({ type: 'UNDO', payload: { count: undoCount } });
    consoleLogger.debug('[session:undo] local requested', { undoCount });
    return;
  }

  // Remote player requested undo
  if (state.hasPendingAction()) {
    bus.emit('REJECT', { action: 'undo', reason: 'busy' }, 'local');
    return;
  }

  // Validate state transitions
  if (!state.canAction('local', 'REMOTE_UNDO')) {
    console.warn('[Undo] Cannot accept remote UNDO request');
    bus.emit('REJECT', { action: 'undo', reason: 'invalid_state' }, 'local');
    return;
  }

  // Extract undo count from payload
  const payload = command.payload as { count?: number } | undefined;
  const count = payload?.count === 2 ? 2 : 1;

  // Validate count value
  if (payload?.count && payload.count !== 1 && payload.count !== 2) {
    bus.emit('REJECT', { action: 'undo', reason: 'invalid' }, 'local');
    return;
  }

  // Validate history is long enough
  if (state.getHistory().length < count) {
    bus.emit('REJECT', { action: 'undo', reason: 'no_history' }, 'local');
    return;
  }

  // Store the pre-request turn for REJECT. APPROVE uses requester ownership
  // in dispatchApprove(), then applies the history rollback.
  const resumePlayer = state.getState('local') === 'turn' ? 'local' : 'remote';

  // Initialize pending undo state
  state.initializeUndoRequest(count as 1 | 2, resumePlayer);

  // Transition to approval waiting state (remote initiated, local approving)
  state.dispatch('local', 'REMOTE_UNDO');
  state.dispatch('remote', 'UNDO');
  consoleLogger.debug('[session:undo] remote requested', {
    count,
    resumePlayer,
  });
};
