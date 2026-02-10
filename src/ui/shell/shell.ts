import { SessionOptions, createSessionController } from "../../session";

export const createShell = (options: SessionOptions) => createSessionController(options);
