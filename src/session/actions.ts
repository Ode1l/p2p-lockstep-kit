import type { CommandBus } from './commandBus';
import type { PendingActionId } from './state/state';

export interface ISessionActions {
  ready(): void;
  start(): void;
  move(data: unknown): void;
  undo(): void;
  restart(): void;
  request(action: PendingActionId, payload?: unknown): void;
  offerDraw(): void;
  resign(): void;
  approve(): void;
  reject(): void;
}

export class LocalActionsAPI implements ISessionActions {
  constructor(private bus: CommandBus) {}

  ready(): void {
    this.bus.emit('READY');
  }

  start(): void {
    this.bus.emit('START');
  }

  move(data: unknown): void {
    this.bus.emit('MOVE', data);
  }

  undo(): void {
    this.bus.emit('UNDO');
  }

  restart(): void {
    this.bus.emit('RESTART');
  }

  request(action: PendingActionId, payload?: unknown): void {
    this.bus.emit('REQUEST', { action, payload });
  }

  offerDraw(): void {
    this.request('draw');
  }

  resign(): void {
    this.bus.emit('RESIGN');
  }

  approve(): void {
    this.bus.emit('APPROVE');
  }

  reject(): void {
    this.bus.emit('REJECT');
  }
}
