import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import type { GameOutcome, PlayerLabel, TurnEntry } from '../state/state';
import { consoleLogger } from '../../utils';

const fromPeerPerspective = (player: PlayerLabel): PlayerLabel =>
  player === 'local' ? 'remote' : 'local';

type SyncPayload = {
  history?: TurnEntry[];
  lastStart?: PlayerLabel | null;
  turn?: PlayerLabel;
  resumeTurn?: PlayerLabel | null;
  outcome?: GameOutcome | null;
};

const getCurrentTurn = (): PlayerLabel => {
  const state = getState();
  return (
    state.getResumeTurn() ??
    (state.getState('local') === 'turn' ? 'local' : 'remote')
  );
};

const buildSyncPayload = (): SyncPayload => {
  const state = getState();
  const turn = getCurrentTurn();

  return {
    history: state.getHistory(),
    lastStart: state.getLastStart(),
    turn,
    resumeTurn: state.getResumeTurn(),
    outcome: state.getOutcome(),
  };
};

const isInSyncRecovery = (): boolean => {
  const state = getState();
  return (
    state.getState('local') === 'syncing' ||
    state.getState('remote') === 'syncing' ||
    state.getState('remote') === 'offline' ||
    state.getResumeTurn() !== null
  );
};

const enterSyncState = (): boolean => {
  const state = getState();

  if (state.getState('local') !== 'syncing') {
    if (!state.canAction('local', 'SYNC')) {
      consoleLogger.debug('[session:sync] local cannot enter sync', {
        local: state.getState('local'),
      });
      return false;
    }
    state.dispatch('local', 'SYNC', 'syncing');
  }

  if (state.getState('remote') === 'offline') {
    if (!state.canAction('remote', 'ONLINE')) {
      consoleLogger.debug('[session:sync] offline remote cannot enter sync', {
        remote: state.getState('remote'),
      });
      return false;
    }
    state.dispatch('remote', 'ONLINE', 'syncing');
  } else if (state.getState('remote') !== 'syncing') {
    if (!state.canAction('remote', 'SYNC')) {
      consoleLogger.debug('[session:sync] remote cannot enter sync', {
        remote: state.getState('remote'),
      });
      return false;
    }
    state.dispatch('remote', 'SYNC', 'syncing');
  }

  return (
    state.getState('local') === 'syncing' &&
    state.getState('remote') === 'syncing'
  );
};

const restoreFromPayload = (
  payload: SyncPayload,
  mapPeerLabels: boolean,
): void => {
  const state = getState();
  const mapPlayer = mapPeerLabels
    ? fromPeerPerspective
    : (player: PlayerLabel) => player;

  if (payload.history && payload.history.length > 0) {
    state.replaceHistory(
      payload.history.map((entry) => ({
        ...entry,
        player: mapPlayer(entry.player),
      })),
    );
  } else {
    state.clearHistory();
  }

  if (payload.lastStart) {
    state.setLastStart(mapPlayer(payload.lastStart));
  } else {
    state.setLastStart(null);
  }

  const mappedOutcome: GameOutcome | null = payload.outcome
    ? payload.outcome.kind === 'win'
      ? { ...payload.outcome, winner: mapPlayer(payload.outcome.winner) }
      : payload.outcome
    : null;
  state.setOutcome(mappedOutcome);

  const nextPlayer = payload.resumeTurn
    ? mapPlayer(payload.resumeTurn)
    : payload.turn
      ? mapPlayer(payload.turn)
      : getCurrentTurn();

  consoleLogger.debug('[session:sync] state restored', {
    historyLength: state.getHistory().length,
    lastStart: state.getLastStart(),
    nextTurnPlayer: nextPlayer,
    mapped: mapPeerLabels,
  });

  if (!enterSyncState()) {
    return;
  }

  if (mappedOutcome) {
    state.dispatch('local', 'GAME_OVER');
    state.dispatch('remote', 'GAME_OVER');
  } else {
    state.dispatchSyncComplete(nextPlayer);
  }
};

/**
 * Handle game state synchronization after disconnect/reconnect
 *
 * SYNC_REQUEST: Initiator sends sync request, responder sends back complete game state
 * SYNC_STATE: Received game state, restore it, and transition both players to correct turn
 *
 * Synced data:
 * - history: All moves in order
 * - lastStart: Who started the last match (for turn rotation)
 * - turn: Current turn holder (to determine resume turn)
 * - resumeTurn: Who should have turn after sync (saved before disconnect)
 *
 * All player labels in SYNC_STATE are from the sender's perspective, so the
 * receiver maps local <-> remote before applying them.
 *
 * Flow:
 * 1. Local disconnects -> offline handler records resumeTurn
 * 2. Local reconnects -> online handler sends SYNC_REQUEST
 * 3. Remote responds with SYNC_STATE (history, lastStart, turn, resumeTurn)
 * 4. Local receives SYNC_STATE -> restores everything, calls dispatchSyncComplete
 * 5. Both FSMs now in correct 'turn'/'remote_turn' state
 */
export const sync: CommandListener = (command) => {
  const state = getState();
  consoleLogger.debug('[session:sync] received', {
    type: command.type,
    from: command.from,
    payload: command.payload,
    local: state.getState('local'),
    remote: state.getState('remote'),
    history: state.getHistory().length,
    resumeTurn: state.getResumeTurn(),
  });

  if (command.type === 'SYNC_REQUEST') {
    if (command.from === 'local') {
      // Local player initiated sync (after reconnection)
      if (
        state.getState('local') !== 'syncing' &&
        !state.canAction('local', 'SYNC')
      ) {
        console.warn('[Sync] Cannot SYNC from current state');
        return;
      }

      // Both transition to syncing state. Local may already be syncing when
      // OFFLINE abandoned a pending approval before ONLINE arrived.
      if (state.getState('local') !== 'syncing') {
        state.dispatch('local', 'SYNC', 'syncing');
      }
      if (state.getState('remote') !== 'syncing') {
        state.dispatch('remote', 'SYNC', 'syncing');
      }

      // Send request to peer (peer will respond with SYNC_STATE)
      send({ type: 'SYNC_REQUEST', from: '', payload: command.payload });
      consoleLogger.debug('[session:sync] request sent');
      return;
    }

    // Remote initiated sync. Send our current timeline first, then also close
    // our own FSM recovery path; the peer might be the only side requesting.
    const payload = buildSyncPayload();
    send({ type: 'SYNC_STATE', from: '', payload });
    consoleLogger.debug('[session:sync] state sent', payload);
    if (isInSyncRecovery()) {
      restoreFromPayload(payload, false);
    }
    return;
  }

  if (command.type !== 'SYNC_STATE') {
    return;
  }

  if (command.from === 'local') {
    const payload = buildSyncPayload();
    send({ type: 'SYNC_STATE', from: '', payload });
    consoleLogger.debug('[session:sync] state pushed', payload);
    if (isInSyncRecovery()) {
      restoreFromPayload(payload, false);
    }
    return;
  }

  restoreFromPayload((command.payload as SyncPayload) || {}, true);
};
