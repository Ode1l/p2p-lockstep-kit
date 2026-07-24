import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import { consoleLogger, type SessionMessage } from '../../utils';

/**
 * Handle player move in game
 *
 * Flow:
 * 1. Validate move using game plugin (rule checking)
 * 2. Dispatch state transitions
 * 3. Record move in history
 * 4. Check win condition using game plugin
 * 5. Always send MOVE to peer, then let both peers check GAME_OVER locally
 *
 * The game plugin is injected via state.setGamePlugin(), allowing
 * different games to provide their own rule validation and win logic.
 */
export const move: CommandListener = (command) => {
  const state = getState();
  const movePayload = command.payload;

  consoleLogger.debug('[session:move] received', {
    from: command.from,
    payload: movePayload,
    local: state.getState('local'),
    remote: state.getState('remote'),
    turn: state.getTurnCount(),
    history: state.getHistory().length,
  });

  if (command.from === 'local') {
    // Local player making a move
    if (!state.canAction('local', 'MOVE')) {
      console.warn('[Move] Cannot MOVE from current state', {
        state: state.getState('local'),
      });
      return;
    }

    // ===== PROXY POINT 1: Validate move using game plugin =====
    const validation = state.validateMove(movePayload);
    if (!validation.valid) {
      console.warn('[Move] Move validation failed', {
        reason: validation.reason,
        move: movePayload,
      });
      // Could send REJECT to inform peer, but for now silently return
      return;
    }

    // Dispatch state transitions
    state.dispatch('local', 'MOVE');
    state.dispatch('remote', 'REMOTE_MOVE');

    // Record move in history
    const turn = state.getTurnCount();
    state.pushHistory({
      turn,
      player: 'local',
      move: movePayload,
    });

    const message: SessionMessage = {
      type: 'MOVE',
      turn,
      payload: movePayload,
    };
    send(message);
    consoleLogger.debug('[session:move] local move sent', {
      turn,
      payload: movePayload,
    });

    // ===== PROXY POINT 2: Check win condition using game plugin =====
    const winner = state.checkWin();
    if (winner) {
      // Game ended - someone won
      consoleLogger.debug('[session:move] game over detected', {
        winner,
        turn,
      });

      state.completeGame({ kind: 'win', winner, reason: 'rules' });
      consoleLogger.debug('[session:move] local game over applied', {
        winner,
        turn,
      });
      return;
    }

    return;
  }

  // Remote player made a move
  if (!state.canAction('remote', 'MOVE')) {
    console.warn('[Move] Cannot MOVE for remote player', {
      state: state.getState('remote'),
    });
    return;
  }

  // ===== PROXY POINT 1: Validate remote move =====
  const validation = state.validateMove(movePayload);
  if (!validation.valid) {
    console.warn('[Move] Remote move validation failed', {
      reason: validation.reason,
      move: movePayload,
    });
    return;
  }

  // Dispatch state transitions
  state.dispatch('remote', 'MOVE');
  state.dispatch('local', 'REMOTE_MOVE');

  // Record move in history
  const turn = state.getTurnCount();
  state.pushHistory({
    turn,
    player: 'remote',
    move: movePayload,
  });

  // ===== PROXY POINT 2: Check win condition =====
  const winner = state.checkWin();
  if (winner) {
    // Game ended - someone won
    consoleLogger.debug('[session:move] game over detected', { winner, turn });

    state.completeGame({ kind: 'win', winner, reason: 'rules' });
    consoleLogger.debug('[session:move] remote game over applied', {
      winner,
      turn,
    });
    return;
  }

  consoleLogger.debug('[session:move] remote move applied', {
    turn,
    payload: movePayload,
  });
};
