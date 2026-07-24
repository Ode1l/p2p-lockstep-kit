export type LifecycleState =
  | "invited"
  | "joining"
  | "mesh_connecting"
  | "seated"
  | "ready"
  | "playing"
  | "ended";

export type AvailabilityState =
  | "online"
  | "offline"
  | "syncing"
  | "failed";

const lifecycleTransitions: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  invited: ["joining"],
  joining: ["invited", "mesh_connecting", "seated", "ready"],
  mesh_connecting: ["seated", "ready"],
  seated: ["ready", "playing"],
  ready: ["seated", "playing"],
  playing: ["ended", "seated"],
  ended: ["seated"],
};

const availabilityTransitions: Readonly<
  Record<AvailabilityState, readonly AvailabilityState[]>
> = {
  online: ["offline", "syncing", "failed"],
  offline: ["syncing", "failed"],
  syncing: ["online", "offline", "failed"],
  failed: [],
};

class Fsm<TState extends string> {
  #state: TState;
  readonly #transitions: Readonly<Record<TState, readonly TState[]>>;

  constructor(
    state: TState,
    transitions: Readonly<Record<TState, readonly TState[]>>,
  ) {
    this.#state = state;
    this.#transitions = transitions;
  }

  getState(): TState {
    return this.#state;
  }

  canTransitionTo(next: TState): boolean {
    return next === this.#state || this.#transitions[this.#state].includes(next);
  }

  transitionTo(next: TState): void {
    if (!this.canTransitionTo(next)) {
      throw new Error(`invalid state transition: ${this.#state} -> ${next}`);
    }
    this.#state = next;
  }
}

export class LifecycleFsm extends Fsm<LifecycleState> {
  constructor(state: LifecycleState) {
    super(state, lifecycleTransitions);
  }
}

export class AvailabilityFsm extends Fsm<AvailabilityState> {
  constructor(state: AvailabilityState = "online") {
    super(state, availabilityTransitions);
  }
}
