import { SessionOptions, createSessionController } from '../../sdk/session';

export const createShell = (options: SessionOptions) => createSessionController(options);
