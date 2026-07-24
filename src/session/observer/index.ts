import type {
  GameOutcome,
  PendingAction,
  PlayerLabel,
  TurnEntry,
  State,
} from '../state/state';
import type { SessionState } from '../state/fsm';
import { consoleLogger } from '../../utils';

export interface GameStateSnapshot {
  localState: SessionState;
  remoteState: SessionState;
  turn: number;
  history: TurnEntry[];
  lastStart: PlayerLabel | null;
  pendingAction: PendingAction;
  outcome: GameOutcome | null;
  connected: boolean;
}

export interface GameEvent {
  type:
    | 'READY'
    | 'START'
    | 'MOVE'
    | 'GAME_OVER'
    | 'UNDO'
    | 'RESTART'
    | 'DRAW'
    | 'RESIGN'
    | 'OFFLINE'
    | 'ONLINE'
    | 'SYNC'
    | 'ERROR';
  payload?: unknown;
  from?: 'local' | 'remote';
  timestamp?: number;
}

export interface IGameObserver {
  onStateChange(snapshot: GameStateSnapshot): void;
  onGameEvent(event: GameEvent): void;
  onConnectionChange?(connected: boolean): void;
  onError?(error: { message: string; context?: unknown }): void;
}

export interface IStateObserver {
  onStateChanged?(): void;
  onHistoryChanged?(): void;
  onGameReset?(): void;
}

export interface IGamePlugin {
  validateMove(move: unknown, gameState: GameState): ValidationResult;
  checkWin(gameState: GameState, history: TurnEntry[]): PlayerLabel | null;
  initialize?(): void;
  cleanup?(): void;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface GameState {
  history: TurnEntry[];
  localState: 'turn' | 'remote_turn' | string;
  remoteState: 'turn' | 'remote_turn' | string;
  turn: number;
  lastStart: PlayerLabel | null;
}

export class DefaultGamePlugin implements IGamePlugin {
  validateMove(): ValidationResult {
    return { valid: true };
  }
  checkWin(): PlayerLabel | null {
    return null;
  }
}

export class StateObserverManager {
  private observers: Set<IStateObserver> = new Set();

  subscribe(observer: IStateObserver): void {
    this.observers.add(observer);
  }

  unsubscribe(observer: IStateObserver): void {
    this.observers.delete(observer);
  }

  notifyStateChanged(): void {
    for (const observer of this.observers) {
      try {
        observer.onStateChanged?.();
      } catch (err) {
        console.error('[StateObserver]', err);
      }
    }
  }

  notifyHistoryChanged(): void {
    for (const observer of this.observers) {
      try {
        observer.onHistoryChanged?.();
      } catch (err) {
        console.error('[StateObserver]', err);
      }
    }
  }

  notifyGameReset(): void {
    for (const observer of this.observers) {
      try {
        observer.onGameReset?.();
      } catch (err) {
        console.error('[StateObserver]', err);
      }
    }
  }
}

export class GameStateObserver {
  private observers: Set<IGameObserver> = new Set();
  private currentSnapshot: GameStateSnapshot | null = null;

  subscribe(observer: IGameObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  unsubscribe(observer: IGameObserver): void {
    this.observers.delete(observer);
  }

  notifyStateChange(snapshot: GameStateSnapshot): void {
    this.currentSnapshot = snapshot;
    for (const observer of this.observers) {
      try {
        observer.onStateChange(snapshot);
      } catch (err) {
        console.error('[GameStateObserver]', err);
      }
    }
  }

  notifyGameEvent(event: GameEvent): void {
    event.timestamp = Date.now();
    for (const observer of this.observers) {
      try {
        observer.onGameEvent(event);
      } catch (err) {
        console.error('[GameStateObserver]', err);
      }
    }
  }

  notifyConnectionChange(connected: boolean): void {
    for (const observer of this.observers) {
      try {
        observer.onConnectionChange?.(connected);
      } catch (err) {
        console.error('[GameStateObserver]', err);
      }
    }
  }

  notifyError(error: { message: string; context?: unknown }): void {
    for (const observer of this.observers) {
      try {
        observer.onError?.(error);
      } catch (err) {
        console.error('[GameStateObserver]', err);
      }
    }
  }

  getSnapshot(): GameStateSnapshot | null {
    return this.currentSnapshot;
  }

  getObserverCount(): number {
    return this.observers.size;
  }
}

export function buildGameStateSnapshot(
  state: State,
  connected: boolean = false,
): GameStateSnapshot {
  return {
    localState: state.getState('local'),
    remoteState: state.getState('remote'),
    turn: state.getTurnCount(),
    history: state.getHistory(),
    lastStart: state.getLastStart(),
    pendingAction: state.getPendingAction(),
    outcome: state.getOutcome(),
    connected,
  };
}

export class UINotificationAdapter implements IStateObserver {
  private lastNotificationTime = 0;
  private notificationThrottleMs = 0;

  constructor(
    private stateRef: State,
    private uiObserver: GameStateObserver,
    private getConnected: () => boolean = () => false,
  ) {}

  onStateChanged(): void {
    const now = Date.now();
    if (this.lastNotificationTime + this.notificationThrottleMs > now) return;
    this.lastNotificationTime = now;

    const snapshot = buildGameStateSnapshot(this.stateRef, this.getConnected());
    consoleLogger.debug('[session:observer] state snapshot', {
      local: snapshot.localState,
      remote: snapshot.remoteState,
      turn: snapshot.turn,
      history: snapshot.history.length,
      pending: snapshot.pendingAction,
      connected: snapshot.connected,
    });
    this.uiObserver.notifyStateChange(snapshot);
  }

  onHistoryChanged(): void {
    this.onStateChanged();
  }

  onGameReset(): void {
    this.onStateChanged();
  }

  emitEvent(event: Omit<GameEvent, 'timestamp'>): void {
    this.uiObserver.notifyGameEvent(event as GameEvent);
  }
}
