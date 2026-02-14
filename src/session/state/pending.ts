export type PendingAction = "undo" | "rejoin" | "restart" | null;

export const createPendingState = () => {
  let pendingAction: PendingAction = null;
  let pendingUndoCount: 1 | 2 | null = null;

  const getAction = () => pendingAction;
  const setAction = (next: PendingAction) => {
    pendingAction = next;
  };

  const getUndoCount = () => pendingUndoCount;
  const setUndoCount = (next: 1 | 2 | null) => {
    pendingUndoCount = next;
  };

  const clearUndo = () => {
    pendingUndoCount = null;
  };

  return {
    getAction,
    setAction,
    getUndoCount,
    setUndoCount,
    clearUndo,
  };
};
