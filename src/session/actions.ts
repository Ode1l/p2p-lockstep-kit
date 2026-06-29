import type { CommandBus } from './commandBus';

export interface ISessionActions {
  ready(): void;
  start(): void;
  move(data: unknown): void;
  undo(): void;
  restart(): void;
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

  approve(): void {
    this.bus.emit('APPROVE');
  }

  reject(): void {
    this.bus.emit('REJECT');
  }
}
