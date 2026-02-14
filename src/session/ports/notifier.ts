import type { Logger } from "../../utils";

export const createNotifier = (deps: {
  logger: Logger;
  showNotice?: (message: string) => void;
  log?: (message: string) => void;
}) => {
  const { logger, showNotice, log } = deps;

  const onRejectNotice = (message: string) => {
    showNotice?.(message);
    log?.(message);
  };

  const onWinner = (label: string) => {
    log?.(label);
  };

  const onConnection = (message: string) => {
    log?.(message);
  };

  const onMoveRejected = (reason?: string) => {
    const msg = reason ? `Move rejected: ${reason}` : "Move rejected";
    logger.warn("[shell] move rejected", reason);
    showNotice?.(msg);
  };

  const onRejectSync = (message: string) => {
    log?.(message);
  };

  return {
    onRejectNotice,
    onWinner,
    onConnection,
    onMoveRejected,
    onRejectSync,
  };
};
