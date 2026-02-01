// Observer/EventEmitter pattern: simple event bus for decoupling.
export class Emitter<Events extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<(payload: any) => void>>();

  public on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void) {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as (payload: any) => void);
    this.handlers.set(event, set);
  }

  public off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void) {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler as (payload: any) => void);
    }
  }

  public emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      handler(payload);
    }
  }
}
