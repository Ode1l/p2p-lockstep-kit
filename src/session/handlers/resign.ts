import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import { consoleLogger } from '../../utils';

export const resign: CommandListener = (command) => {
  if (command.type !== 'RESIGN') return;
  const state = getState();

  const previous = state.getOutcome();
  if (previous?.kind === 'win' && previous.reason === 'resignation') {
    state.setOutcome({ kind: 'draw', reason: 'mutual_resignation' });
    consoleLogger.debug('[session:resign] simultaneous resignation resolved');
    return;
  }
  if (previous || state.hasPendingAction()) return;

  const active =
    state.getState('local') === 'turn' ||
    state.getState('local') === 'remote_turn';
  if (!active) return;

  if (command.from === 'local') {
    send({ type: 'RESIGN' });
    state.completeGame({
      kind: 'win',
      winner: 'remote',
      reason: 'resignation',
    });
  } else {
    state.completeGame({
      kind: 'win',
      winner: 'local',
      reason: 'resignation',
    });
  }
  consoleLogger.debug('[session:resign] game completed', {
    from: command.from,
    outcome: state.getOutcome(),
  });
};
