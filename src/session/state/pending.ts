export type PendingActionType = "undo" | "rejoin" | "restart";

export type PendingResult = {
  ok: boolean;
  reason?: string;
};

type PendingEntry = {
  action: PendingActionType;
  undoCount?: 1 | 2;
  resolve: (result: PendingResult) => void;
};

type PendingPhase = "idle" | "waiting" | "resolved" | "rejected";

type PendingEvent = {
  phase: PendingPhase;
  action: PendingActionType | null;
  reason?: string;
};

export const createPendingState = () => {
  let entry: PendingEntry | null = null;
  let phase: PendingPhase = "idle";
  const listeners = new Set<(event: PendingEvent) => void>();

  const emit = (event: PendingEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const transition = (next: PendingPhase, detail?: { action?: PendingActionType | null; reason?: string }) => {
    phase = next;
    emit({ phase: next, action: detail?.action ?? entry?.action ?? null, reason: detail?.reason });
  };

  const begin = (
    action: PendingActionType,
    options?: { undoCount?: 1 | 2 },
  ): Promise<PendingResult> => {
    if (entry) {
      entry.resolve({ ok: false, reason: "replaced" });
    }
    let resolvePromise: (result: PendingResult) => void = () => {};
    const promise = new Promise<PendingResult>((res) => {
      resolvePromise = res;
    });
    entry = {
      action,
      undoCount: options?.undoCount,
      resolve: resolvePromise,
    };
    transition("waiting", { action });
    return promise;
  };

  const settleToIdle = () => {
    transition("idle", { action: null });
  };

  const resolve = (action: PendingActionType) => {
    if (entry?.action !== action) {
      return;
    }
    entry.resolve({ ok: true });
    entry = null;
    transition("resolved", { action });
    settleToIdle();
  };

  const reject = (action: PendingActionType, reason?: string) => {
    if (entry?.action !== action) {
      return;
    }
    entry.resolve({ ok: false, reason });
    entry = null;
    transition("rejected", { action, reason });
    settleToIdle();
  };

  const clear = (reason?: string) => {
    if (entry) {
      entry.resolve({ ok: false, reason: reason ?? "cleared" });
      const currentAction = entry.action;
      entry = null;
      transition("rejected", { action: currentAction, reason: reason ?? "cleared" });
      settleToIdle();
    } else {
      settleToIdle();
    }
  };

  const getAction = (): PendingActionType | null => entry?.action ?? null;
  const getUndoCount = () => entry?.undoCount ?? null;
  const getPhase = () => phase;

  const onChange = (handler: (event: PendingEvent) => void) => {
    listeners.add(handler);
    return () => listeners.delete(handler);
  };

  return {
    begin,
    resolve,
    reject,
    clear,
    getAction,
    getUndoCount,
    getPhase,
    onChange,
  };
};
