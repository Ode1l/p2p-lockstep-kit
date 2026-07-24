import type { StatusPanelState } from "../types";
import { setText } from "../utils/dom";
import { emit } from "../utils/events";

const defaultState: StatusPanelState = {
  theme: "light",
  gameTitle: "P2P Lockstep",
  peerId: "",
  remotePeerId: "",
  connected: false,
  connectionState: "idle",
  currentTurn: 1,
  turnOwner: null,
  localState: "idle",
  remoteState: "idle",
  readySelf: false,
  readyPeer: false,
  pendingAction: null,
  outcome: null,
  sessionId: "default-session",
  historyLength: 0,
  lastStart: null,
  lastError: "",
};

const turnLabel = (owner: StatusPanelState["turnOwner"]) => {
  if (owner === "me") {
    return "Your turn";
  }
  if (owner === "peer") {
    return "Peer turn";
  }
  return "Waiting";
};

const outcomeLabel = (outcome: StatusPanelState["outcome"]) => {
  if (!outcome) return null;
  if (outcome.kind === "draw") {
    return outcome.reason === "agreement"
      ? "Draw by agreement"
      : "Draw by mutual resignation";
  }
  const subject = outcome.winner === "local" ? "You win" : "Peer wins";
  return outcome.reason === "resignation"
    ? `${subject} by resignation`
    : subject;
};

const readinessLabel = (
  player: "Me" | "Peer",
  state: StatusPanelState["localState"],
) => {
  if (state === "ready") {
    return `${player} ready`;
  }
  if (state === "could_start") {
    return player === "Me" ? "You can start" : "Peer can start";
  }
  return `${player} idle`;
};

const stateLabel = (
  player: "Local" | "Remote",
  state: StatusPanelState["localState"],
) => {
  const subject = player === "Local" ? "You" : "Peer";
  if (state === "idle") {
    return `${subject} idle`;
  }
  if (state === "ready") {
    return `${subject} ready`;
  }
  if (state === "could_start") {
    return `${subject} can start`;
  }
  return `${subject} ${state.replaceAll("_", " ")}`;
};

const connectionDisplay = (
  connected: boolean,
  state: StatusPanelState["connectionState"],
) => {
  if (connected || state === "connected") {
    return {
      label: "Live",
      detail: "connected",
      tone: "bg-[var(--lock-teal)]",
    };
  }

  if (state === "registering") {
    return {
      label: "Registering",
      detail: "signal server",
      tone: "bg-[var(--lock-bronze)]",
    };
  }

  if (state === "registered") {
    return {
      label: "Registered",
      detail: "ready to share",
      tone: "bg-[var(--lock-bronze-bright)]",
    };
  }

  if (state === "connecting") {
    return {
      label: "Connecting",
      detail: "peer handshake",
      tone: "bg-[var(--lock-bronze-bright)]",
    };
  }

  if (state === "offline") {
    return {
      label: "Offline",
      detail: "waiting reconnect",
      tone: "bg-[var(--lock-dim)]",
    };
  }

  if (state === "error") {
    return {
      label: "Error",
      detail: "check signal",
      tone: "bg-[var(--lock-rose)]",
    };
  }

  return {
    label: "Standby",
    detail: "not registered",
    tone: "bg-[var(--lock-dim)]",
  };
};

export class P2PLockstepStatusPanelElement extends HTMLElement {
  #state: StatusPanelState = defaultState;
  #ready = false;

  connectedCallback() {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    this.addEventListener("click", this.#handleClick);
    this.render();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
  }

  set state(value: StatusPanelState) {
    this.#state = value;
    if (this.#ready) {
      this.render();
    }
  }

  get state() {
    return this.#state;
  }

  render() {
    const { connected, pendingAction } = this.#state;
    const outcome = outcomeLabel(this.#state.outcome);
    const connection = connectionDisplay(
      connected,
      this.#state.connectionState,
    );
    const selfReadyLabel = readinessLabel("Me", this.#state.localState);
    const peerReadyLabel = readinessLabel("Peer", this.#state.remoteState);
    const localStateLabel = stateLabel("Local", this.#state.localState);
    const remoteStateLabel = stateLabel("Remote", this.#state.remoteState);
    const readySummary = `${selfReadyLabel} / ${peerReadyLabel}`;
    const starterLabel =
      this.#state.lastStart === "local"
        ? "You"
        : this.#state.lastStart === "remote"
          ? "Peer"
          : "Not started";
    const timelineSummary =
      outcome ??
      `${this.#state.historyLength} move${this.#state.historyLength === 1 ? "" : "s"} / ${starterLabel}`;

    this.className = "block";
    this.innerHTML = `
      <section class="lock-panel relative rounded-[1.25rem] p-2.5 text-sm text-[var(--lock-muted)] sm:rounded-[1.5rem] sm:p-3 lg:rounded-[1.75rem] lg:p-2.5">
        <div class="flex items-center gap-2 lg:hidden">
          <div class="min-w-0 flex-1">
            <p data-mobile-title class="truncate text-sm font-semibold leading-tight text-[var(--lock-paper)]"></p>
            <div class="mt-1 flex min-w-0 items-center gap-1.5 text-[0.68rem] leading-none text-[var(--lock-muted)]">
              <span class="h-2 w-2 shrink-0 rounded-full ${connection.tone}"></span>
              <span data-mobile-connection class="shrink-0 font-medium"></span>
              <span class="text-[var(--lock-dim)]">/</span>
              <span data-mobile-turn class="min-w-0 truncate"></span>
            </div>
          </div>

          <div class="hidden shrink-0 rounded-full border border-[var(--lock-border)] px-2.5 py-1 text-[0.65rem] text-[var(--lock-muted)] min-[390px]:block">
            <span data-mobile-ready></span>
          </div>

          <details class="group shrink-0">
            <summary
              aria-label="Match details"
              class="lock-control flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--lock-border)] text-base font-semibold leading-none text-[var(--lock-muted)] transition hover:border-[var(--lock-border-strong)] [&::-webkit-details-marker]:hidden"
            >
              ...
            </summary>
            <div class="lock-surface-strong absolute inset-x-0 top-full z-50 mt-2 max-h-[calc(100svh-6rem)] overflow-auto rounded-[1.35rem] border border-[var(--lock-border-strong)] p-3.5 shadow-2xl shadow-black/15 backdrop-blur-xl lg:inset-auto lg:right-0 lg:w-[min(22rem,calc(100vw-1.5rem))]">
              <div class="grid grid-cols-2 gap-2">
                <article class="lock-card rounded-[1rem] border border-[var(--lock-border)] p-3">
                  <p class="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--lock-dim)]">Connection</p>
                  <p data-detail-connection class="mt-1.5 text-sm font-semibold text-[var(--lock-paper)]"></p>
                </article>
                <article class="lock-card rounded-[1rem] border border-[var(--lock-border)] p-3">
                  <p class="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--lock-dim)]">Turn</p>
                  <p data-detail-turn class="mt-1.5 text-sm font-semibold text-[var(--lock-paper)]"></p>
                </article>
              </div>

              <div class="lock-card mt-2 rounded-[1rem] border border-[var(--lock-border)] p-3">
                <p class="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--lock-dim)]">Identity</p>
                <p class="lock-mono mt-1.5 break-all text-xs text-[var(--lock-muted)]">Session: <span data-detail-session class="text-[var(--lock-paper)]"></span></p>
                <p class="lock-mono mt-1.5 break-all text-xs text-[var(--lock-muted)]">Me: <span data-detail-peer class="text-[var(--lock-paper)]"></span></p>
                <p class="lock-mono mt-1.5 break-all text-xs text-[var(--lock-muted)]">Peer: <span data-detail-remote class="text-[var(--lock-paper)]"></span></p>
              </div>

              <div class="lock-card mt-2 rounded-[1rem] border border-[var(--lock-border)] p-3">
                <p class="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--lock-dim)]">Timeline</p>
                <p data-detail-timeline class="mt-1.5 text-sm font-semibold text-[var(--lock-paper)]"></p>
                ${
                  this.#state.lastError
                    ? `<p data-detail-error class="mt-1.5 break-words text-xs text-[var(--lock-rose)]"></p>`
                    : ""
                }
              </div>

              <div class="lock-card mt-2 rounded-[1rem] border border-[var(--lock-border)] p-3">
                <p class="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--lock-dim)]">Appearance</p>
                <div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Color mode">
                  <button type="button" data-theme-mode="light" class="lock-theme-option rounded-xl px-3 py-2 text-xs font-semibold" aria-label="Use day mode" aria-pressed="${this.#state.theme === "light"}">Day</button>
                  <button type="button" data-theme-mode="dark" class="lock-theme-option rounded-xl px-3 py-2 text-xs font-semibold" aria-label="Use night mode" aria-pressed="${this.#state.theme === "dark"}">Night</button>
                </div>
              </div>

              <div class="mt-2 flex flex-wrap gap-1.5">
                <span data-detail-ready-self class="rounded-full border border-[var(--lock-border)] px-2.5 py-1 text-[0.68rem] text-[var(--lock-muted)]"></span>
                <span data-detail-ready-peer class="rounded-full border border-[var(--lock-border)] px-2.5 py-1 text-[0.68rem] text-[var(--lock-muted)]"></span>
                <span data-detail-local-state class="rounded-full border border-[var(--lock-border)] px-2.5 py-1 text-[0.68rem] text-[var(--lock-muted)]"></span>
                <span data-detail-remote-state class="rounded-full border border-[var(--lock-border)] px-2.5 py-1 text-[0.68rem] text-[var(--lock-muted)]"></span>
                ${
                  pendingAction
                    ? `<span class="rounded-full border border-[var(--lock-border-strong)] bg-[var(--lock-pending-bg)] px-2.5 py-1 text-[0.68rem] text-[var(--lock-bronze-bright)]">Pending ${pendingAction}</span>`
                    : ""
                }
                ${
                  outcome
                    ? `<span class="rounded-full border border-[var(--lock-border-strong)] bg-[var(--lock-pending-bg)] px-2.5 py-1 text-[0.68rem] text-[var(--lock-bronze-bright)]">${outcome}</span>`
                    : ""
                }
              </div>
            </div>
          </details>
        </div>

        <div class="hidden gap-2 lg:grid">
          <article class="lock-card rounded-[1.15rem] border border-[var(--lock-border)] p-2.5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--lock-dim)]">Match</p>
                <p data-title class="mt-1.5 truncate text-xl font-semibold leading-none tracking-[-0.035em] text-[var(--lock-paper)]"></p>
                <p data-match-meta class="mt-1.5 text-xs text-[var(--lock-muted)]"></p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full ${connection.tone}"></span>
                <details class="group relative">
                  <summary aria-label="Appearance settings" class="lock-control flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--lock-border)] text-xs font-semibold leading-none text-[var(--lock-muted)] [&::-webkit-details-marker]:hidden">...</summary>
                  <div class="lock-surface-strong absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-[var(--lock-border-strong)] p-3 shadow-xl shadow-black/15">
                    <p class="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--lock-dim)]">Appearance</p>
                    <div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Color mode">
                      <button type="button" data-theme-mode="light" class="lock-theme-option rounded-xl px-3 py-2 text-xs font-semibold" aria-label="Use day mode" aria-pressed="${this.#state.theme === "light"}">Day</button>
                      <button type="button" data-theme-mode="dark" class="lock-theme-option rounded-xl px-3 py-2 text-xs font-semibold" aria-label="Use night mode" aria-pressed="${this.#state.theme === "dark"}">Night</button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </article>

          <div class="grid grid-cols-2 gap-2">
            <article class="lock-card rounded-[1rem] border border-[var(--lock-border)] p-2.5">
              <p class="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--lock-dim)]">Connection</p>
              <p class="mt-1.5 text-sm font-semibold text-[var(--lock-paper)]">${connection.label}</p>
              <p data-connection-state class="mt-0.5 truncate text-xs text-[var(--lock-muted)]"></p>
            </article>

            <article class="lock-card rounded-[1rem] border border-[var(--lock-border)] p-2.5">
              <p class="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--lock-dim)]">Turn</p>
              <p data-current-turn class="mt-1.5 text-sm font-semibold text-[var(--lock-paper)]"></p>
              <p data-turn-owner class="mt-0.5 truncate text-xs text-[var(--lock-muted)]"></p>
            </article>
          </div>

          <article class="lock-card min-w-0 overflow-hidden rounded-[1.15rem] border border-[var(--lock-border)] p-2.5">
            <p class="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--lock-dim)]">Identity</p>
            <div class="mt-2 grid gap-1.5 text-xs">
              <p class="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 text-[var(--lock-muted)]">
                <span>Session</span>
                <span data-session-id class="lock-mono block min-w-0 truncate text-right text-[var(--lock-paper)]"></span>
              </p>
              <p class="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-2 text-[var(--lock-muted)]">
                <span>Me</span>
                <span data-peer-id class="lock-mono block min-w-0 break-all text-right text-[var(--lock-paper)]"></span>
              </p>
              <p class="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-2 text-[var(--lock-muted)]">
                <span>Peer</span>
                <span data-remote-peer-id class="lock-mono block min-w-0 break-all text-right text-[var(--lock-paper)]"></span>
              </p>
            </div>
          </article>

          ${
            this.#state.lastError
              ? `<article class="rounded-[1.15rem] border border-[var(--lock-border)] bg-[var(--lock-error-bg)] p-2.5">
                  <p class="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--lock-rose)]">Last error</p>
                  <p data-error-message class="mt-1.5 break-words text-xs leading-5 text-[var(--lock-paper)]"></p>
                </article>`
              : ""
          }

          <article class="lock-card rounded-[1.15rem] border border-[var(--lock-border)] p-2.5">
            <p class="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--lock-dim)]">State</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span data-ready-self class="rounded-full border border-[var(--lock-border)] px-2 py-0.5 text-[0.64rem] text-[var(--lock-muted)]"></span>
              <span data-ready-peer class="rounded-full border border-[var(--lock-border)] px-2 py-0.5 text-[0.64rem] text-[var(--lock-muted)]"></span>
              <span data-local-state class="rounded-full border border-[var(--lock-border)] px-2 py-0.5 text-[0.64rem] text-[var(--lock-muted)]"></span>
              <span data-remote-state class="rounded-full border border-[var(--lock-border)] px-2 py-0.5 text-[0.64rem] text-[var(--lock-muted)]"></span>
              ${
                pendingAction
                  ? `<span class="rounded-full border border-[var(--lock-border-strong)] bg-[var(--lock-pending-bg)] px-2 py-0.5 text-[0.64rem] text-[var(--lock-bronze-bright)]">Pending ${pendingAction}</span>`
                  : ""
              }
              ${
                outcome
                  ? `<span class="rounded-full border border-[var(--lock-border-strong)] bg-[var(--lock-pending-bg)] px-2 py-0.5 text-[0.64rem] text-[var(--lock-bronze-bright)]">${outcome}</span>`
                  : ""
              }
            </div>
          </article>
        </div>
      </section>
    `;

    setText(this, "[data-mobile-title]", this.#state.gameTitle);
    setText(this, "[data-mobile-connection]", connection.label);
    setText(
      this,
      "[data-mobile-turn]",
      outcome ?? `#${this.#state.currentTurn} ${turnLabel(this.#state.turnOwner)}`,
    );
    setText(this, "[data-mobile-ready]", readySummary);
    setText(this, "[data-detail-connection]", connection.label);
    setText(
      this,
      "[data-detail-turn]",
      `#${this.#state.currentTurn} / ${turnLabel(this.#state.turnOwner)}`,
    );
    setText(this, "[data-detail-session]", this.#state.sessionId);
    setText(this, "[data-detail-timeline]", timelineSummary);
    setText(this, "[data-detail-error]", this.#state.lastError);
    setText(this, "[data-detail-peer]", this.#state.peerId || "not set");
    setText(
      this,
      "[data-detail-remote]",
      this.#state.remotePeerId || "not set",
    );
    setText(this, "[data-detail-ready-self]", selfReadyLabel);
    setText(this, "[data-detail-ready-peer]", peerReadyLabel);
    setText(this, "[data-detail-local-state]", localStateLabel);
    setText(this, "[data-detail-remote-state]", remoteStateLabel);
    setText(this, "[data-title]", this.#state.gameTitle);
    setText(this, "[data-match-meta]", timelineSummary);
    setText(this, "[data-error-message]", this.#state.lastError);
    setText(this, "[data-connection-state]", connection.detail);
    setText(
      this,
      "[data-current-turn]",
      outcome ?? `#${this.#state.currentTurn}`,
    );
    setText(
      this,
      "[data-turn-owner]",
      outcome ? "Game over" : turnLabel(this.#state.turnOwner),
    );
    setText(this, "[data-session-id]", this.#state.sessionId);
    setText(
      this,
      "[data-peer-id]",
      this.#state.peerId || "Local peer ID will appear after register.",
    )?.setAttribute("title", this.#state.peerId);
    setText(
      this,
      "[data-remote-peer-id]",
      this.#state.remotePeerId || "Remote peer not connected yet.",
    )?.setAttribute("title", this.#state.remotePeerId);
    setText(this, "[data-ready-self]", selfReadyLabel);
    setText(this, "[data-ready-peer]", peerReadyLabel);
    setText(this, "[data-local-state]", localStateLabel);
    setText(this, "[data-remote-state]", remoteStateLabel);
  }

  #handleClick = (event: Event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      "button[data-theme-mode]",
    );
    if (
      button?.dataset.themeMode === "light" ||
      button?.dataset.themeMode === "dark"
    ) {
      emit(this, "lockstep-theme-change", { theme: button.dataset.themeMode });
    }
  };
}
