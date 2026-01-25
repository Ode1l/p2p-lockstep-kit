export type EventMap = Record<string, unknown>;

export type Unsubscribe = () => void;

export type Emitter<TEvents extends EventMap> = {
  on<K extends keyof TEvents>(
    type: K,
    handler: (payload: TEvents[K]) => void,
  ): Unsubscribe;
  off<K extends keyof TEvents>(type: K, handler: (payload: TEvents[K]) => void): void;
  emit<K extends keyof TEvents>(type: K, payload: TEvents[K]): void;
  clear(): void;
};

export const createEmitter = <TEvents extends EventMap>(): Emitter<TEvents> => {
  const handlers = new Map<keyof TEvents, Set<(payload: unknown) => void>>();

  const on: Emitter<TEvents>["on"] = (type, handler) => {
    let set = handlers.get(type);
    if (!set) {
      set = new Set();
      handlers.set(type, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => off(type, handler);
  };

  const off: Emitter<TEvents>["off"] = (type, handler) => {
    handlers.get(type)?.delete(handler as (payload: unknown) => void);
  };

  const emit: Emitter<TEvents>["emit"] = (type, payload) => {
    const set = handlers.get(type);
    if (!set) {
      return;
    }
    for (const handler of set) {
      handler(payload);
    }
  };

  const clear = () => handlers.clear();

  return { on, off, emit, clear };
};

