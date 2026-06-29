import type { DialogState } from "../types";
import { setText } from "../utils/dom";
import { emit } from "../utils/events";

const defaultState: DialogState = {
  open: false,
  title: "",
  description: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
};

export class P2PLockstepConfirmDialogElement extends HTMLElement {
  #state: DialogState = defaultState;
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

  set state(value: DialogState) {
    this.#state = value;
    if (this.#ready) {
      this.render();
    }
  }

  get state() {
    return this.#state;
  }

  render() {
    const { open } = this.#state;
    this.className = open ? "fixed inset-0 z-50 block" : "hidden";
    this.innerHTML = `
      <div data-overlay class="absolute inset-0 bg-[var(--lock-overlay)] backdrop-blur-sm"></div>
      <div class="relative flex min-h-full items-end justify-center p-4 sm:items-center">
        <section class="lock-panel w-full max-w-md rounded-[2rem] p-6">
          <div class="space-y-3">
            <p class="text-[0.72rem] uppercase tracking-[0.28em] text-[var(--lock-bronze-bright)]">Action Required</p>
            <h3 data-title class="lock-title text-2xl font-semibold text-[var(--lock-paper)]"></h3>
            <p data-description class="text-sm leading-6 text-[var(--lock-muted)]"></p>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              data-action="confirm"
              class="lock-primary inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition"
            >
              <span data-confirm-label></span>
            </button>
            <button
              type="button"
              data-action="cancel"
              class="lock-secondary inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition"
            >
              <span data-cancel-label></span>
            </button>
          </div>
        </section>
      </div>
    `;
    setText(this, "[data-title]", this.#state.title);
    setText(this, "[data-description]", this.#state.description);
    setText(this, "[data-confirm-label]", this.#state.confirmLabel);
    setText(this, "[data-cancel-label]", this.#state.cancelLabel);
  }

  #handleClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.matches("[data-overlay]") || target.closest("[data-action='cancel']")) {
      emit(this, "lockstep-dialog-cancel");
      return;
    }
    if (target.closest("[data-action='confirm']")) {
      emit(this, "lockstep-dialog-confirm");
    }
  };
}
