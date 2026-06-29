import { CommandBus } from '../commandBus';
import { ready } from './ready';
import { start } from './start';
import { move } from './move';
import { request } from './request';
import { sync } from './sync';
import { undo } from './undo';
import { restart } from './restart';
import { offline } from './offLine';

export const registerHandlers = (bus: CommandBus) => {
  bus.register('READY', ready);
  bus.register('START', start);
  bus.register('MOVE', move);
  bus.register('UNDO', undo);
  bus.register('RESTART', restart);
  bus.register('SYNC_REQUEST', sync);
  bus.register('SYNC_STATE', sync);
  bus.register('OFFLINE', offline);
  bus.register('ONLINE', offline);
  bus.register('APPROVE', request);
  bus.register('REJECT', request);
};
