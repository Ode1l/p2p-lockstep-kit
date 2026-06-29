import type { ActionBarState } from "../types";
import { emit } from "../utils/events";

const defaultState: ActionBarState = {
  connected: false,
  readySelf: false,
  canReady: false,
  canStart: false,
  canUndo: false,
  canRestart: false,
  started: false,
  connectionState: "idle",
};

export class P2PLockstepActionBarElement extends HTMLElement {
  #state: ActionBarState = defaultState;
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

  set state(value: ActionBarState) {
    this.#state = value;
    if (this.#ready) {
      this.render();
    }
  }

  get state() {
    return this.#state;
  }

  render() {
    const {
      canReady,
      canStart,
      canUndo,
      canRestart,
      connected,
      readySelf,
      started,
    } = this.#state;
    const primaryAction = canStart
      ? "start"
      : readySelf || canReady
        ? "ready"
        : "";
    const primaryLabel = canStart
      ? "Start"
      : readySelf
        ? "Unready"
        : canReady
          ? "Ready"
          : connected
            ? "Waiting"
            : "Waiting for connection";
    const showPrimary = !started || Boolean(primaryAction);
    const stageLabel = started
      ? "In game"
      : canStart
        ? "Start ready"
        : readySelf
          ? "Ready"
          : "Setup";

    this.className = "block";
    this.innerHTML = `
      <section class="lock-panel rounded-[1.25rem] p-2.5 sm:rounded-[1.5rem] sm:p-3 lg:rounded-[1.75rem] lg:p-2.5">
        <div class="flex flex-col gap-2 sm:gap-3">
          <div class="hidden items-center justify-between gap-3 px-1 lg:flex">
            <p class="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[var(--lock-dim)]">Controls</p>
            <span class="rounded-full border border-[var(--lock-border)] px-2.5 py-1 text-[0.65rem] text-[var(--lock-muted)]">${stageLabel}</span>
          </div>

          ${
            showPrimary
              ? `<button
                  type="button"
                  data-action="${primaryAction}"
                  class="lock-disabled inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition sm:py-3 ${
                    canStart
                      ? "lock-primary"
                      : canReady
                        ? "bg-[var(--lock-teal)] text-[#08120f] shadow-[0_12px_32px_rgba(110,231,200,0.22)] hover:brightness-105"
                        : "lock-secondary"
                  }"
                  ${primaryAction ? "" : "disabled"}
                >
                  ${primaryLabel}
                </button>`
              : ""
          }

          <div class="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              type="button"
              data-action="undo"
              class="lock-secondary lock-disabled inline-flex items-center justify-center rounded-full px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:py-3 sm:text-sm"
              ${canUndo ? "" : "disabled"}
            >
              Undo
            </button>
            <button
              type="button"
              data-action="restart"
              class="lock-secondary lock-disabled inline-flex items-center justify-center rounded-full px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:py-3 sm:text-sm"
              ${canRestart ? "" : "disabled"}
            >
              Restart
            </button>
          </div>
        </div>
      </section>
    `;
  }

  #handleClick = (event: Event) => {
    const target = (
      event.target as HTMLElement | null
    )?.closest<HTMLButtonElement>("button[data-action]");
    if (!target || target.disabled) {
      return;
    }
    emit(this, `lockstep-${target.dataset.action}`);
  };
}
