import type { CommandMiddleware } from "./commandRegistry";
import type { Logger } from "../utils";

export const createLogMiddleware = (logger: Logger): CommandMiddleware => {
  return ({ msg, origin }) => {
    logger.info("[session] recv", {
      origin,
      type: msg.type,
      sid: msg.sid,
      from: msg.from,
      seq: msg.seq,
    });
  };
};

export const createDefaultMiddlewares = (logger: Logger): CommandMiddleware[] => {
  return [createLogMiddleware(logger)];
};
