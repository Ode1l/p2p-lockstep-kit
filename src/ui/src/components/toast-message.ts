import type { ToastState } from "../types";
import { setText } from "../utils/dom";

const defaultState: ToastState = {
  open: false,
  message: "",
};

export class P2PLockstepToastMessageElement extends HTMLElement {
  #state: ToastState = defaultState;
  #ready = false;

  connectedCallback() {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    this.render();
  }

  set state(value: ToastState) {
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
    this.className = "pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:justify-end";
    this.innerHTML = `
      <div
        class="lock-surface-strong max-w-sm rounded-full border border-[var(--lock-border-strong)] px-4 py-3 text-sm font-medium text-[var(--lock-paper)] shadow-lg shadow-black/15 backdrop-blur-xl transition duration-200 ${
          open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }"
      >
        <span data-message></span>
      </div>
    `;
    setText(this, "[data-message]", this.#state.message);
  }
}
