import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import { consoleLogger } from '../../utils';

type RequestAction = 'undo' | 'restart' | 'draw';
type RequestPayload = {
  action?: string;
  reason?: string;
};

const isRequestAction = (value: unknown): value is RequestAction =>
  value === 'undo' || value === 'restart' || value === 'draw';

const applyApprovedAction = (action: RequestAction): void => {
  const state = getState();
  if (action === 'undo') {
    state.applyUndo(state.getPendingUndoCount() ?? 1);
  } else if (action === 'restart') {
    state.resetGame();
  } else {
    state.completeGame({ kind: 'draw', reason: 'agreement' });
  }
};

/**
 * Handle approval/rejection of pending requests (undo/restart)
 *
 * When local player approves/rejects a pending request:
 * - Apply undo/restart state changes (clear history, pop moves)
 * - Use dispatchApprove/dispatchReject for complex state transitions
 * - Notify peer of decision
 *
 * When remote player approves/rejects local's request:
 * - Similar flow but opposite state transitions
 */
export const request: CommandListener = (command) => {
  if (command.type !== 'APPROVE' && command.type !== 'REJECT') {
    return;
  }

  const state = getState();
  const payload = command.payload as RequestPayload | undefined;
  const pendingAction = state.getPendingAction();
  const action =
    pendingAction ??
    (command.from === 'local' &&
    command.type === 'REJECT' &&
    isRequestAction(payload?.action)
      ? payload.action
      : null);
  consoleLogger.debug('[session:request] received', {
    type: command.type,
    from: command.from,
    action,
    local: state.getState('local'),
    remote: state.getState('remote'),
    history: state.getHistory().length,
  });

  if (!action) {
    console.warn('[Request] No pending action', { commandType: command.type });
    return;
  }

  // Verify payload matches pending action
  if (payload?.action && payload.action !== action) {
    console.warn('[Request] Action mismatch', {
      pending: action,
      payload: payload.action,
    });
    return;
  }

  if (command.from === 'local') {
    if (!pendingAction && command.type === 'REJECT') {
      send({
        type: 'REJECT',
        payload: { action, reason: payload?.reason ?? 'rejected' },
      });
      consoleLogger.debug('[session:request] local auto rejected', {
        action,
        reason: payload?.reason,
      });
      return;
    }

    if (command.type === 'APPROVE') {
      // Local player approves the request
      if (!state.canAction('local', 'APPROVE')) {
        console.warn('[Request] Cannot APPROVE from current state');
        return;
      }

      // Use special method for complex APPROVE transition
      state.dispatchApprove();

      applyApprovedAction(action);

      send({ type: 'APPROVE', payload: { action } });
      state.clearPendingStates();
      consoleLogger.debug('[session:request] local approved', { action });
      return;
    }

    // REJECT from local
    if (!state.canAction('local', 'REJECT')) {
      console.warn('[Request] Cannot REJECT from current state');
      return;
    }

    // Use special method for complex REJECT transition
    state.dispatchReject();

    send({
      type: 'REJECT',
      payload: { action, reason: payload?.reason ?? 'rejected' },
    });
    state.clearPendingStates();
    consoleLogger.debug('[session:request] local rejected', { action });
    return;
  }

  // Remote player responded to local's request
  if (command.type === 'APPROVE') {
    // Remote player approves
    if (!state.canAction('local', 'APPROVE')) {
      console.warn(
        '[Request] Cannot APPROVE from current state (remote approved)',
      );
      return;
    }

    // Use special method for complex APPROVE transition
    state.dispatchApprove();

    applyApprovedAction(action);

    state.clearPendingStates();
    consoleLogger.debug('[session:request] remote approved', { action });
    return;
  }

  // REJECT from remote
  if (!state.canAction('local', 'REJECT')) {
    console.warn(
      '[Request] Cannot REJECT from current state (remote rejected)',
    );
    state.clearPendingStates();
    return;
  }

  // Use special method for complex REJECT transition
  state.dispatchReject();
  state.clearPendingStates();
  consoleLogger.debug('[session:request] remote rejected', { action });
};
