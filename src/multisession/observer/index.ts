import type { JsonValue } from "../../utils/serialization/json";
import type { ParticipantId } from "../ids";
import type { OrderedEvent } from "../state/events";
import type { MultiGamePlugin } from "../plugin/types";
import type { MultiSessionState, ProtocolError } from "../state/types";
import type { Unsubscribe } from "../transport/types";

export interface MultiSessionSnapshot<TGameSnapshot extends JsonValue> {
  readonly state: Omit<MultiSessionState<unknown>, "game">;
  readonly game: TGameSnapshot | null;
  readonly historyLength: number;
  readonly history: readonly OrderedEvent[];
}

export interface MultiSessionObserver<TGameSnapshot extends JsonValue> {
  onStateChange(snapshot: MultiSessionSnapshot<TGameSnapshot>): void;
  onError?(error: ProtocolError): void;
  onPrivateMessage?(message: Readonly<{
    fromParticipantId: ParticipantId;
    data: JsonValue;
    relatedEventId?: string;
  }>): void;
}

export class GameStateObserver<TGameSnapshot extends JsonValue> {
  readonly #observers = new Set<MultiSessionObserver<TGameSnapshot>>();
  #snapshot: MultiSessionSnapshot<TGameSnapshot> | null = null;

  subscribe(observer: MultiSessionObserver<TGameSnapshot>): Unsubscribe {
    this.#observers.add(observer);
    if (this.#snapshot) {
      this.#safe(() => observer.onStateChange(structuredClone(this.#snapshot!)));
    }
    return () => this.#observers.delete(observer);
  }

  notify(snapshot: MultiSessionSnapshot<TGameSnapshot>): void {
    this.#snapshot = structuredClone(snapshot);
    for (const observer of [...this.#observers]) {
      this.#safe(() => observer.onStateChange(structuredClone(this.#snapshot!)));
    }
  }

  notifyError(error: ProtocolError): void {
    for (const observer of [...this.#observers]) {
      this.#safe(() => observer.onError?.(structuredClone(error)));
    }
  }

  notifyPrivateMessage(message: Readonly<{
    fromParticipantId: ParticipantId;
    data: JsonValue;
    relatedEventId?: string;
  }>): void {
    for (const observer of [...this.#observers]) {
      this.#safe(() => observer.onPrivateMessage?.(structuredClone(message)));
    }
  }

  getSnapshot(): MultiSessionSnapshot<TGameSnapshot> | null {
    return this.#snapshot === null ? null : structuredClone(this.#snapshot);
  }

  getObserverCount(): number {
    return this.#observers.size;
  }

  clear(): void {
    this.#observers.clear();
    this.#snapshot = null;
  }

  #safe(action: () => void): void {
    try {
      action();
    } catch {
      // Observer failures are isolated from session state.
    }
  }
}

export const buildGameStateSnapshot = <
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
>(
  state: MultiSessionState<TGameState>,
  history: readonly OrderedEvent[],
  plugin: MultiGamePlugin<TCommand, TEventPayload, TGameState, TGameSnapshot>,
): MultiSessionSnapshot<TGameSnapshot> => ({
  state: (() => {
    const { game: _game, ...view } = state;
    return structuredClone(view);
  })(),
  game:
    state.game === null
      ? null
      : structuredClone(plugin.createSnapshot(state.game)),
  historyLength: history.length,
  history: structuredClone(history),
});
