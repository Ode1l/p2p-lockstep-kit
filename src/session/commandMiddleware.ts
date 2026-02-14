import type { CommandMiddleware } from "./commandRegistry";
import type { Logger, MessageType } from "../utils";
import type { SessionFsm } from "./state/fsm";

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

export const createFsmGuardMiddleware = (deps: {
  fsm: SessionFsm;
  logger: Logger;
  onLocalBlock?: (message: string) => void;
}): CommandMiddleware => {
  const { fsm, logger, onLocalBlock } = deps;
  return ({ msg, origin }) => {
    const result = fsm.guard(msg.type as MessageType, origin);
    if (result.ok) {
      return true;
    }
    if (origin === "local") {
      onLocalBlock?.(result.reason ?? `Action ${msg.type} is not allowed.`);
    } else {
      logger.warn("[session:fsm] drop", { type: msg.type, phase: fsm.getPhase() });
    }
    return false;
  };
};
