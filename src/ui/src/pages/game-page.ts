import type { ActionBarState, GamePageState, StatusPanelState } from "../types";
import type { P2PLockstepBoardHostElement } from "../game/board-host";

const defaultState: GamePageState = {
  theme: "light",
  gameTitle: "P2P Lockstep",
  peerId: "",
  remotePeerId: "",
  connected: false,
  connectionState: "idle",
  readySelf: false,
  readyPeer: false,
  canReady: false,
  canStart: false,
  canUndo: false,
  canRestart: false,
  started: false,
  currentTurn: 1,
  turnOwner: null,
  localState: "idle",
  remoteState: "idle",
  pendingAction: null,
  sessionId: "default-session",
  historyLength: 0,
  lastStart: null,
  lastError: "",
};

export class P2PLockstepGamePageElement extends HTMLElement {
  #state: GamePageState = defaultState;
  #ready = false;
  #statusPanel: (HTMLElement & { state: StatusPanelState }) | null = null;
  #actionBar: (HTMLElement & { state: ActionBarState }) | null = null;
  #boardHost: P2PLockstepBoardHostElement | null = null;

  connectedCallback() {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    this.render();
    this.#syncChildren();
  }

  set state(value: GamePageState) {
    this.#state = value;
    if (this.#ready) {
      this.#syncChildren();
    }
  }

  get state() {
    return this.#state;
  }

  render() {
    this.className = "block h-full";
    this.innerHTML = `
      <section class="flex h-[calc(100svh-1.5rem)] flex-col items-center gap-2.5 overflow-visible sm:h-auto sm:min-h-[calc(100svh-3rem)] sm:gap-4 lg:grid lg:h-full lg:min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-5">
        <aside class="contents lg:relative lg:z-40 lg:col-start-2 lg:row-start-1 lg:flex lg:w-full lg:flex-col lg:gap-3">
          <div class="relative z-40 order-1 w-full max-w-[45rem] lg:order-none lg:max-w-none">
            <p2p-lockstep-status-panel></p2p-lockstep-status-panel>
          </div>

          <div class="order-3 w-full max-w-[45rem] shrink-0 lg:order-none lg:max-w-none">
            <p2p-lockstep-action-bar></p2p-lockstep-action-bar>
          </div>
        </aside>

        <div class="order-2 min-h-0 w-full max-w-[45rem] flex-1 lg:order-none lg:col-start-1 lg:row-start-1 lg:h-full lg:max-w-none">
          <p2p-lockstep-board-host></p2p-lockstep-board-host>
        </div>
      </section>
    `;

    this.#statusPanel = this.querySelector("p2p-lockstep-status-panel");
    this.#actionBar = this.querySelector("p2p-lockstep-action-bar");
    this.#boardHost = this.querySelector("p2p-lockstep-board-host");
  }

  getBoardHost() {
    return this.#boardHost?.getMount() ?? null;
  }

  #syncChildren() {
    if (!this.#statusPanel || !this.#actionBar) {
      return;
    }

    this.#statusPanel.state = {
      theme: this.#state.theme,
      gameTitle: this.#state.gameTitle,
      peerId: this.#state.peerId,
      remotePeerId: this.#state.remotePeerId,
      connected: this.#state.connected,
      connectionState: this.#state.connectionState,
      currentTurn: this.#state.currentTurn,
      turnOwner: this.#state.turnOwner,
      localState: this.#state.localState,
      remoteState: this.#state.remoteState,
      readySelf: this.#state.readySelf,
      readyPeer: this.#state.readyPeer,
      pendingAction: this.#state.pendingAction,
      sessionId: this.#state.sessionId,
      historyLength: this.#state.historyLength,
      lastStart: this.#state.lastStart,
      lastError: this.#state.lastError,
    };

    this.#actionBar.state = {
      connected: this.#state.connected,
      readySelf: this.#state.readySelf,
      canReady: this.#state.canReady,
      canStart: this.#state.canStart,
      canUndo: this.#state.canUndo,
      canRestart: this.#state.canRestart,
      started: this.#state.started,
      connectionState: this.#state.connectionState,
    };
  }
}
