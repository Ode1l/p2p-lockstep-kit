export type SessionState =
  | 'idle'
  | 'ready'
  | 'could_start'
  | 'turn'
  | 'remote_turn'
  | 'approving'
  | 'waiting_approval'
  | 'syncing'
  | 'offline';

export type SessionEvent =
  | 'REMOTE_READY'
  | 'READY'
  | 'START'
  | 'REMOTE_START'
  | 'MOVE'
  | 'REMOTE_MOVE'
  | 'UNDO'
  | 'REMOTE_UNDO'
  | 'RESTART'
  | 'REMOTE_RESTART'
  | 'REQUEST'
  | 'REMOTE_REQUEST'
  | 'APPROVE'
  | 'REJECT'
  | 'GAME_OVER'
  | 'SYNC'
  | 'SYNC_COMPLETE'
  | 'OFFLINE'
  | 'ONLINE';

export type Transition = {
  from: SessionState;
  event: SessionEvent;
  to: SessionState;
};

const transitions: Transition[] = [
  // Pre-match readiness
  { from: 'idle', event: 'READY', to: 'ready' },
  { from: 'ready', event: 'READY', to: 'idle' },
  { from: 'idle', event: 'REMOTE_READY', to: 'could_start' },
  { from: 'could_start', event: 'REMOTE_READY', to: 'idle' },
  { from: 'ready', event: 'REJECT', to: 'idle' },
  { from: 'could_start', event: 'REJECT', to: 'idle' },

  // Match start / turn assignment
  { from: 'ready', event: 'REMOTE_START', to: 'turn' },
  { from: 'ready', event: 'REMOTE_START', to: 'remote_turn' },
  { from: 'could_start', event: 'START', to: 'turn' },
  { from: 'could_start', event: 'START', to: 'remote_turn' },

  // Turn swapping after moves
  { from: 'turn', event: 'MOVE', to: 'remote_turn' },
  { from: 'remote_turn', event: 'REMOTE_MOVE', to: 'turn' },
  { from: 'turn', event: 'REJECT', to: 'turn' },
  { from: 'remote_turn', event: 'REJECT', to: 'remote_turn' },

  // Requests initiated by local player (undo/restart)
  { from: 'turn', event: 'UNDO', to: 'waiting_approval' },
  { from: 'remote_turn', event: 'UNDO', to: 'waiting_approval' },
  { from: 'turn', event: 'RESTART', to: 'waiting_approval' },
  { from: 'remote_turn', event: 'RESTART', to: 'waiting_approval' },
  { from: 'turn', event: 'REQUEST', to: 'waiting_approval' },
  { from: 'remote_turn', event: 'REQUEST', to: 'waiting_approval' },

  // Requests coming from remote (we need to approve)
  { from: 'turn', event: 'REMOTE_UNDO', to: 'approving' },
  { from: 'remote_turn', event: 'REMOTE_UNDO', to: 'approving' },
  { from: 'turn', event: 'REMOTE_RESTART', to: 'approving' },
  { from: 'remote_turn', event: 'REMOTE_RESTART', to: 'approving' },
  { from: 'turn', event: 'REMOTE_REQUEST', to: 'approving' },
  { from: 'remote_turn', event: 'REMOTE_REQUEST', to: 'approving' },

  // Approval outcomes when we were waiting for the peer.
  { from: 'waiting_approval', event: 'APPROVE', to: 'turn' },
  { from: 'waiting_approval', event: 'REJECT', to: 'turn' },
  { from: 'waiting_approval', event: 'REJECT', to: 'remote_turn' },

  // Approval outcomes when we were confirming the peer's request.
  // The target turn is explicit because resumeTurn decides who continues.
  { from: 'approving', event: 'APPROVE', to: 'remote_turn' },
  { from: 'approving', event: 'REJECT', to: 'remote_turn' },
  { from: 'approving', event: 'REJECT', to: 'turn' },

  // Game end resets back to the pre-match idle state
  { from: 'turn', event: 'GAME_OVER', to: 'idle' },
  { from: 'remote_turn', event: 'GAME_OVER', to: 'idle' },
  { from: 'waiting_approval', event: 'GAME_OVER', to: 'idle' },
  { from: 'approving', event: 'GAME_OVER', to: 'idle' },
  { from: 'syncing', event: 'GAME_OVER', to: 'idle' },

  // Rejoin/sync flows
  { from: 'turn', event: 'SYNC', to: 'syncing' },
  { from: 'remote_turn', event: 'SYNC', to: 'syncing' },
  { from: 'waiting_approval', event: 'SYNC', to: 'syncing' },
  { from: 'approving', event: 'SYNC', to: 'syncing' },
  { from: 'idle', event: 'SYNC', to: 'syncing' },
  { from: 'ready', event: 'SYNC', to: 'syncing' },
  { from: 'could_start', event: 'SYNC', to: 'syncing' },
  { from: 'syncing', event: 'SYNC_COMPLETE', to: 'turn' },
  { from: 'syncing', event: 'SYNC_COMPLETE', to: 'remote_turn' },

  // Connection state
  { from: 'idle', event: 'OFFLINE', to: 'offline' },
  { from: 'ready', event: 'OFFLINE', to: 'offline' },
  { from: 'could_start', event: 'OFFLINE', to: 'offline' },
  { from: 'turn', event: 'OFFLINE', to: 'offline' },
  { from: 'remote_turn', event: 'OFFLINE', to: 'offline' },
  { from: 'waiting_approval', event: 'OFFLINE', to: 'offline' },
  { from: 'approving', event: 'OFFLINE', to: 'offline' },
  { from: 'syncing', event: 'OFFLINE', to: 'offline' },
  { from: 'offline', event: 'ONLINE', to: 'syncing' },
];
// only receive 'to' from state. never receive from handlers.
const nextState = (
  state: SessionState,
  event: SessionEvent,
  to?: SessionState, // next turn or pending action
): SessionState => {
  if (to) {
    if (
      !!transitions.find(
        (t) => t.from === state && t.event === event && t.to === to,
      )
    ) {
      return to;
    } else {
      return state;
    }
  } else {
    const hit = transitions.find((t) => t.from === state && t.event === event);
    return hit ? hit.to : state;
  }
};

const hasNextState = (
  state: SessionState,
  action: SessionEvent,
  to?: SessionState,
): boolean => {
  if (to) {
    return !!transitions.find(
      (t) => t.from === state && t.event === action && t.to === to,
    );
  }
  return !!transitions.find((t) => t.from === state && t.event === action);
};

export class SessionFsm {
  private state: SessionState;

  constructor(state: SessionState = 'idle') {
    this.state = state;
  }

  public getState(): SessionState {
    return this.state;
  }

  public hasNextState(event: SessionEvent, to?: SessionState): boolean {
    return hasNextState(this.state, event, to);
  }

  public dispatch(action: SessionEvent, to?: SessionState) {
    this.state = nextState(this.state, action, to);
  }
}
