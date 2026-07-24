import type { CommandListener } from '../commandBus';
import { getBus, getState, send } from '../context';
import { consoleLogger } from '../../utils';

/**
 * Handle restart request from local or remote player
 *
 * Validates restart is legal (no pending action, valid state)
 * and initiates restart request with peer approval flow.
 *
 * Restart clears all history but keeps player order for next match.
 */
export const restart: CommandListener = (command) => {
  if (command.type !== 'RESTART') {
    return;
  }

  const state = getState();
  const bus = getBus();
  consoleLogger.debug('[session:restart] received', {
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
    if (!state.canAction('local', 'RESTART')) {
      console.warn('[Restart] Cannot RESTART from current state');
      return;
    }

    // Determine who will go first in next match
    const resumePlayer =
      state.getState('local') === 'turn' ? 'local' : 'remote';

    // Initialize pending restart state
    state.initializeRestartRequest(resumePlayer);

    // Transition to approval waiting state
    state.dispatch('local', 'RESTART');
    state.dispatch('remote', 'REMOTE_RESTART');

    send({ type: 'RESTART' });
    consoleLogger.debug('[session:restart] local requested', { resumePlayer });
    return;
  }

  // Remote player requested restart
  if (state.hasPendingAction()) {
    bus.emit('REJECT', { action: 'restart', reason: 'busy' }, 'local');
    return;
  }

  // Validate state transitions
  if (!state.canAction('local', 'REMOTE_RESTART')) {
    console.warn('[Restart] Cannot accept remote RESTART request');
    bus.emit('REJECT', { action: 'restart', reason: 'invalid_state' }, 'local');
    return;
  }

  // Determine who will go first in next match
  const resumePlayer = state.getState('local') === 'turn' ? 'local' : 'remote';

  // Initialize pending restart state
  state.initializeRestartRequest(resumePlayer);

  // Transition to approval waiting state (remote initiated, local approving)
  state.dispatch('local', 'REMOTE_RESTART');
  state.dispatch('remote', 'RESTART');
  consoleLogger.debug('[session:restart] remote requested', { resumePlayer });
};
