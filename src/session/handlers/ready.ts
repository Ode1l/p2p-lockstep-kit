import type { CommandListener } from '../commandBus';
import { getBus, getSid, getState, send } from '../context';
import { consoleLogger, type SessionMessage } from '../../utils';

/**
 * Handle player ready status notification
 *
 * For most cases, there's only one valid FSM transition:
 * - READY: idle → ready (for initiator)
 * - REMOTE_READY: idle → could_start (for peer)
 *
 * The dispatch() method automatically finds the unique transition.
 */
export const ready: CommandListener = (command) => {
  const state = getState();
  const bus = getBus();
  const localSid = getSid();
  consoleLogger.debug('[session:ready] received', {
    from: command.from,
    sid: (command as any).sid,
    localSid,
    local: state.getState('local'),
    remote: state.getState('remote'),
  });

  if (command.from === 'local') {
    // Local player initiating READY
    if (!state.canAction('local', 'READY')) {
      console.warn('[Ready] Cannot dispatch READY from current state', {
        state: state.getState('local'),
      });
      return;
    }

    state.dispatch('local', 'READY');
    state.dispatch('remote', 'REMOTE_READY');

    const message: SessionMessage = {
      type: 'READY',
      sid: localSid,
    };
    send(message);
    consoleLogger.debug('[session:ready] local toggled', {
      local: state.getState('local'),
      remote: state.getState('remote'),
    });
    return;
  }

  // Remote player sent READY message
  const remoteSid = (command as any).sid;

  // Validate session ID
  if (!remoteSid || localSid !== remoteSid) {
    console.warn('[Ready] Session ID mismatch', {
      local: localSid,
      remote: remoteSid,
    });
    bus.emit('REJECT', { reason: 'sid-mismatch' }, 'local');
    return;
  }

  // Check if transition is valid
  if (!state.canAction('remote', 'READY')) {
    console.warn('[Ready] Cannot dispatch READY for remote peer', {
      state: state.getState('remote'),
    });
    return;
  }

  // Execute state transitions
  state.dispatch('remote', 'READY');
  state.dispatch('local', 'REMOTE_READY');
  consoleLogger.debug('[session:ready] remote toggled', {
    local: state.getState('local'),
    remote: state.getState('remote'),
  });
};
