import type { CommandListener } from '../commandBus';
import { getBus, getState, send } from '../context';
import type { PendingActionId, PlayerLabel } from '../state/state';
import { consoleLogger } from '../../utils';

type RequestPayload = { action?: unknown; payload?: unknown };

const isGenericRequestAction = (
  value: unknown,
): value is Exclude<PendingActionId, 'undo' | 'restart'> => value === 'draw';

const currentTurn = (): PlayerLabel =>
  getState().getState('local') === 'turn' ? 'local' : 'remote';

export const pendingRequest: CommandListener = (command) => {
  if (command.type !== 'REQUEST') return;
  const state = getState();
  const bus = getBus();
  const payload = command.payload as RequestPayload | undefined;
  const action = payload?.action;

  if (!isGenericRequestAction(action)) {
    if (command.from === 'remote') {
      send({
        type: 'REJECT',
        payload: { action, reason: 'unknown_action' },
      });
    }
    return;
  }

  if (state.getOutcome()) return;

  if (command.from === 'local') {
    if (state.hasPendingAction() || !state.canAction('local', 'REQUEST')) {
      return;
    }
    const resumeTurn = currentTurn();
    state.initializePendingRequest(action, resumeTurn);
    state.dispatch('local', 'REQUEST');
    state.dispatch('remote', 'REMOTE_REQUEST');
    send({ type: 'REQUEST', payload: { action, payload: payload?.payload } });
    consoleLogger.debug('[session:request] local requested', { action });
    return;
  }

  if (state.hasPendingAction()) {
    bus.emit('REJECT', { action, reason: 'busy' }, 'local');
    return;
  }
  if (!state.canAction('local', 'REMOTE_REQUEST')) {
    bus.emit('REJECT', { action, reason: 'invalid_state' }, 'local');
    return;
  }

  const resumeTurn = currentTurn();
  state.initializePendingRequest(action, resumeTurn);
  state.dispatch('local', 'REMOTE_REQUEST');
  state.dispatch('remote', 'REQUEST');
  consoleLogger.debug('[session:request] remote requested', { action });
};
