import { SessionEvent, SessionFsm, SessionState } from './fsm';
import type {
  IGamePlugin,
  GameState,
  ValidationResult,
  IStateObserver,
} from '../observer';
import { DefaultGamePlugin, StateObserverManager } from '../observer';
import { consoleLogger } from '../../utils';

export type TurnEntry = {
  turn: number;
  player: 'local' | 'remote';
  move?: unknown;
};

export type PlayerLabel = 'local' | 'remote';
export type PendingActionId = 'undo' | 'restart' | 'draw';
export type PendingAction = PendingActionId | null;
export type GameOutcome =
  | {
      kind: 'win';
      winner: PlayerLabel;
      reason: 'rules' | 'resignation';
    }
  | {
      kind: 'draw';
      reason: 'agreement' | 'mutual_resignation';
    };

export class State {
  // will update map when multi-players (>=3)
  private local = new SessionFsm('idle');
  private remote = new SessionFsm('idle');
  // for compare remote is same people or not
  private readonly localId: string | null = null;
  private remoteId: string | null = null;
  // store all actions
  private readonly history: TurnEntry[] = [];
  // pending some state
  private pendingAction: PendingAction = null;
  private pendingUndoCount: 1 | 2 | null = null;
  private resumeTurn: PlayerLabel | null = null;
  private lastStart: PlayerLabel | null = null;
  private outcome: GameOutcome | null = null;

  // Game plugin for rule validation and win checking
  private gamePlugin: IGamePlugin = new DefaultGamePlugin();

  // Internal state observer for UI notifications
  private stateObserverManager = new StateObserverManager();

  constructor(id: string | null, remoteId: string | null) {
    if (id) {
      this.localId = id;
    }
    if (remoteId) {
      this.remoteId = remoteId;
    }
    consoleLogger.debug('[session:state] created', { localId: id, remoteId });
  }

  /**
   * Register an internal observer (like plugin pattern)
   * Use this to connect State mutations to UI updates
   */
  public subscribeStateObserver(observer: IStateObserver): void {
    this.stateObserverManager.subscribe(observer);
  }

  // ...existing code...

  public getId(): string | null {
    return this.localId;
  }

  public getremoteId(): string | null {
    return this.remoteId;
  }

  public setremoteId(id: string) {
    this.remoteId = id;
    consoleLogger.debug('[session:state] remote id set', { remoteId: id });
  }

  public getState(player: PlayerLabel): SessionState {
    return this.getPlayerFsm(player).getState();
  }

  public getTurnCount(): number {
    return this.history.length + 1;
  }

  public getHistory(): TurnEntry[] {
    return this.history.slice();
  }

  public replaceHistory(entries: TurnEntry[]): void {
    consoleLogger.debug('[session:history] replace', { count: entries.length });
    this.clearHistory();
    entries.forEach((entry) => {
      this.pushHistory({
        turn: entry.turn,
        player: entry.player,
        move: entry.move,
      });
    });
  }

  public clearHistory(): void {
    const count = this.history.length;
    this.history.splice(0, this.history.length);
    consoleLogger.debug('[session:history] clear', { count });
    this.notifyHistoryChanged();
  }

  public pushHistory(entry: TurnEntry): void {
    this.history.push(entry);
    consoleLogger.debug('[session:history] push', {
      turn: entry.turn,
      player: entry.player,
      move: entry.move,
      count: this.history.length,
    });
    this.notifyHistoryChanged();
  }

  public popHistory(): TurnEntry | null {
    const entry = this.history.pop() ?? null;
    if (entry) {
      consoleLogger.debug('[session:history] pop', {
        turn: entry.turn,
        player: entry.player,
        move: entry.move,
        count: this.history.length,
      });
      this.notifyHistoryChanged();
    }
    return entry;
  }

  public canAction(player: PlayerLabel, action: SessionEvent): boolean {
    return this.getPlayerFsm(player).hasNextState(action);
  }

  /**
   * Dispatch an action and automatically determine target state if unique
   * Only use explicit 'to' parameter for ambiguous transitions (APPROVE, REJECT, etc.)
   *
   * For most actions (READY, MOVE, START, etc.), there's only one valid transition,
   * so we automatically find and apply it.
   */
  public dispatch(
    player: PlayerLabel,
    action: SessionEvent,
    to?: SessionState,
  ): void {
    const before = this.getState(player);
    this.getPlayerFsm(player).dispatch(action, to);
    const after = this.getState(player);
    consoleLogger.debug(`[session:fsm] ${player} ${action}`, {
      from: before,
      to: after,
      requested: to,
      local: this.getState('local'),
      remote: this.getState('remote'),
      turn: this.getTurnCount(),
      history: this.history.length,
      pending: this.pendingAction,
    });
    this.notifyStateChanged();
  }

  public setPendingAction(action: PendingAction) {
    consoleLogger.debug('[session:state] pending action set', {
      from: this.pendingAction,
      to: action,
    });
    this.pendingAction = action;
  }

  public getPendingAction(): PendingAction {
    return this.pendingAction;
  }

  public setPendingUndoCount(count: 1 | 2 | null) {
    consoleLogger.debug('[session:state] pending undo count set', {
      from: this.pendingUndoCount,
      to: count,
    });
    this.pendingUndoCount = count;
  }

  public getPendingUndoCount(): 1 | 2 | null {
    return this.pendingUndoCount;
  }

  public setLastStart(player: PlayerLabel | null) {
    consoleLogger.debug('[session:state] last start set', {
      from: this.lastStart,
      to: player,
    });
    this.lastStart = player;
  }

  public getLastStart(): PlayerLabel | null {
    return this.lastStart;
  }

  public setResumeTurn(player: PlayerLabel | null) {
    consoleLogger.debug('[session:state] resume turn set', {
      from: this.resumeTurn,
      to: player,
    });
    this.resumeTurn = player;
  }

  public getResumeTurn(): PlayerLabel | null {
    return this.resumeTurn;
  }

  public setOutcome(outcome: GameOutcome | null): void {
    consoleLogger.debug('[session:state] outcome set', {
      from: this.outcome,
      to: outcome,
    });
    this.outcome = outcome;
    this.notifyStateChanged();
  }

  public getOutcome(): GameOutcome | null {
    return this.outcome;
  }

  private getPlayerFsm(player: PlayerLabel): SessionFsm {
    return player === 'local' ? this.local : this.remote;
  }

  private notifyStateChanged(): void {
    consoleLogger.debug('[session:state] notify state changed', {
      local: this.getState('local'),
      remote: this.getState('remote'),
      turn: this.getTurnCount(),
      history: this.history.length,
      pending: this.pendingAction,
    });
    this.stateObserverManager.notifyStateChanged();
  }

  private notifyHistoryChanged(): void {
    consoleLogger.debug('[session:state] notify history changed', {
      turn: this.getTurnCount(),
      history: this.history.length,
      pending: this.pendingAction,
    });
    this.stateObserverManager.notifyHistoryChanged();
  }

  private notifyGameReset(): void {
    consoleLogger.debug('[session:state] notify game reset');
    this.stateObserverManager.notifyGameReset();
  }

  private dispatchPair(
    localAction: SessionEvent,
    localTo: SessionState,
    remoteAction: SessionEvent,
    remoteTo: SessionState,
  ): void {
    const before = {
      local: this.local.getState(),
      remote: this.remote.getState(),
    };
    this.local.dispatch(localAction, localTo);
    this.remote.dispatch(remoteAction, remoteTo);
    consoleLogger.debug('[session:fsm] pair dispatch', {
      before,
      after: {
        local: this.local.getState(),
        remote: this.remote.getState(),
      },
      localAction,
      localTo,
      remoteAction,
      remoteTo,
      turn: this.getTurnCount(),
      history: this.history.length,
      pending: this.pendingAction,
    });
    this.notifyStateChanged();
  }

  // ===== Helper Methods for Approval Request Handling =====

  /**
   * Save game state snapshot for undo/restart operations
   */
  private gameSnapshot: unknown = null;

  public saveGameSnapshot(snapshot: unknown): void {
    this.gameSnapshot = snapshot;
    consoleLogger.debug('[session:state] game snapshot saved', { snapshot });
  }

  public getGameSnapshot(): unknown {
    return this.gameSnapshot;
  }

  public clearGameSnapshot(): void {
    this.gameSnapshot = null;
    consoleLogger.debug('[session:state] game snapshot cleared');
  }

  /**
   * Check if there's a pending action (undo/restart)
   */
  public hasPendingAction(): boolean {
    return this.pendingAction !== null;
  }

  /**
   * Clear all pending states (called after approval/rejection)
   */
  public clearPendingStates(): void {
    consoleLogger.debug('[session:state] pending states cleared', {
      pending: this.pendingAction,
      pendingUndoCount: this.pendingUndoCount,
      resumeTurn: this.resumeTurn,
    });
    this.pendingAction = null;
    this.pendingUndoCount = null;
    this.resumeTurn = null;
    this.notifyStateChanged();
  }

  /**
   * Initialize undo request with undo count and current turn holder
   */
  public initializeUndoRequest(
    undoCount: 1 | 2,
    resumeTurn: PlayerLabel,
  ): void {
    this.pendingAction = 'undo';
    this.pendingUndoCount = undoCount;
    this.resumeTurn = resumeTurn;
    consoleLogger.debug('[session:state] undo request initialized', {
      undoCount,
      resumeTurn,
    });
  }

  /**
   * Initialize restart request with resume turn
   */
  public initializeRestartRequest(resumeTurn: PlayerLabel): void {
    this.pendingAction = 'restart';
    this.resumeTurn = resumeTurn;
    consoleLogger.debug('[session:state] restart request initialized', {
      resumeTurn,
    });
  }

  public initializePendingRequest(
    action: Exclude<PendingActionId, 'undo' | 'restart'>,
    resumeTurn: PlayerLabel,
  ): void {
    this.pendingAction = action;
    this.resumeTurn = resumeTurn;
    consoleLogger.debug('[session:state] approval request initialized', {
      action,
      resumeTurn,
    });
  }

  /**
   * Check if pending action is undo
   */
  public isPendingUndo(): boolean {
    return this.pendingAction === 'undo';
  }

  /**
   * Check if pending action is restart
   */
  public isPendingRestart(): boolean {
    return this.pendingAction === 'restart';
  }

  /**
   * Apply undo by popping history N times
   */
  public applyUndo(count: 1 | 2 = 1): void {
    consoleLogger.debug('[session:history] apply undo', { count });
    for (let i = 0; i < count; i++) {
      this.popHistory();
    }
  }

  /**
   * Reset game state to initial (for restart)
   */
  public resetGame(): void {
    consoleLogger.debug('[session:state] reset game', {
      local: this.getState('local'),
      remote: this.getState('remote'),
      history: this.history.length,
      lastStart: this.lastStart,
      pending: this.pendingAction,
    });
    this.clearHistory();
    this.local = new SessionFsm('idle');
    this.remote = new SessionFsm('idle');
    this.lastStart = null;
    this.outcome = null;
    this.pendingAction = null;
    this.pendingUndoCount = null;
    this.resumeTurn = null;
    this.notifyGameReset();
    this.notifyStateChanged();
  }

  /**
   * Save start player for reconnect synchronization
   */
  public recordStartPlayer(player: PlayerLabel): void {
    this.lastStart = player;
    consoleLogger.debug('[session:state] start player recorded', { player });
  }

  /**
   * Get move to undo from history
   */
  public getLastMove(): TurnEntry | null {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : null;
  }

  // ===== Specialized FSM Dispatch Methods =====

  /**
   * Dispatch APPROVE action with automatic target state resolution
   * Multiple valid transitions exist - use state context to determine target
   */
  public dispatchApprove(): void {
    const localState = this.local.getState();
    if (localState === 'waiting_approval') {
      // Local requested the action; peer approved it.
      this.dispatchPair('APPROVE', 'turn', 'APPROVE', 'remote_turn');
    } else if (localState === 'approving') {
      // Peer requested the action; local approved it.
      this.dispatchPair('APPROVE', 'remote_turn', 'APPROVE', 'turn');
    }
  }

  /**
   * Dispatch REJECT action with automatic target state resolution
   * Multiple valid transitions exist - use resumeTurn to determine who continues
   */
  public dispatchReject(): void {
    const localState = this.local.getState();

    if (localState === 'waiting_approval' || localState === 'approving') {
      // resumeTurn tells us who should have turn after rejection
      const localTarget = this.resumeTurn === 'local' ? 'turn' : 'remote_turn';
      const remoteTarget = this.resumeTurn === 'local' ? 'remote_turn' : 'turn';
      this.dispatchPair('REJECT', localTarget, 'REJECT', remoteTarget);
    }
  }

  /**
   * Dispatch START action with automatic target state resolution
   * Determines who plays first based on starter parameter
   */
  public dispatchStart(firstPlayer: PlayerLabel): void {
    const before = {
      local: this.local.getState(),
      remote: this.remote.getState(),
      lastStart: this.lastStart,
    };
    if (firstPlayer === 'local') {
      this.local.dispatch('START', 'turn');
      this.remote.dispatch('START', 'remote_turn');
      this.lastStart = 'local';
    } else {
      this.local.dispatch('START', 'remote_turn');
      this.remote.dispatch('START', 'turn');
      this.lastStart = 'remote';
    }
    consoleLogger.debug('[session:fsm] start dispatch', {
      before,
      firstPlayer,
      after: {
        local: this.local.getState(),
        remote: this.remote.getState(),
        lastStart: this.lastStart,
      },
    });
    this.notifyStateChanged();
  }

  /**
   * Dispatch SYNC_COMPLETE with automatic target state resolution
   * Based on who should have the turn after sync
   */
  public dispatchSyncComplete(nextPlayer: PlayerLabel): void {
    if (nextPlayer === 'local') {
      this.dispatchPair(
        'SYNC_COMPLETE',
        'turn',
        'SYNC_COMPLETE',
        'remote_turn',
      );
    } else {
      this.dispatchPair(
        'SYNC_COMPLETE',
        'remote_turn',
        'SYNC_COMPLETE',
        'turn',
      );
    }
    this.resumeTurn = null;
  }

  // ===== Game Plugin Integration (Proxy Pattern) =====

  /**
   * Set the game plugin for rule validation and win checking
   * @param plugin Implementation of IGamePlugin
   */
  public setGamePlugin(plugin: IGamePlugin): void {
    this.gamePlugin = plugin;
    consoleLogger.debug('[session:plugin] game plugin set', {
      hasInitialize: Boolean(plugin.initialize),
      hasCleanup: Boolean(plugin.cleanup),
    });
    if (plugin.initialize) {
      plugin.initialize();
    }
  }

  /**
   * Get current game plugin
   */
  public getGamePlugin(): IGamePlugin {
    return this.gamePlugin;
  }

  /**
   * Validate a move using the game plugin
   * Called by move handler to check if move is legal
   * @param move The move data to validate
   * @returns Validation result with reason if invalid
   */
  public validateMove(move: unknown): ValidationResult {
    const gameState = this.buildGameState();
    const result = this.gamePlugin.validateMove(move, gameState);
    consoleLogger.debug('[session:plugin] validate move', {
      move,
      result,
      local: gameState.localState,
      remote: gameState.remoteState,
      turn: gameState.turn,
      history: gameState.history.length,
    });
    return result;
  }

  /**
   * Check if game has ended (someone won)
   * Called by move handler after move is applied
   * @returns Winner (local/remote) or null if game continues
   */
  public checkWin(): PlayerLabel | null {
    const gameState = this.buildGameState();
    const winner = this.gamePlugin.checkWin(gameState, this.getHistory());
    consoleLogger.debug('[session:plugin] check win', {
      winner,
      turn: gameState.turn,
      history: gameState.history.length,
    });
    return winner;
  }

  public completeGame(outcome: GameOutcome): void {
    this.setOutcome(outcome);
    if (this.canAction('local', 'GAME_OVER')) {
      this.dispatch('local', 'GAME_OVER');
    }
    if (this.canAction('remote', 'GAME_OVER')) {
      this.dispatch('remote', 'GAME_OVER');
    }
    this.clearPendingStates();
    this.cleanupGame();
  }

  /**
   * Cleanup when game ends (for plugin to reset internal state)
   */
  public cleanupGame(): void {
    if (this.gamePlugin.cleanup) {
      this.gamePlugin.cleanup();
    }
    consoleLogger.debug('[session:plugin] cleanup game');
  }

  /**
   * Build game state for plugin
   * @private
   */
  private buildGameState(): GameState {
    return {
      history: this.getHistory(),
      localState: this.getState('local'),
      remoteState: this.getState('remote'),
      turn: this.getTurnCount(),
      lastStart: this.getLastStart(),
    };
  }
}
