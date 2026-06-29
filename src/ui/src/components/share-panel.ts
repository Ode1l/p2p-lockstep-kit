import QRCode from "qrcode";
import type { SharePanelState } from "../types";
import { setText } from "../utils/dom";
import { emit } from "../utils/events";

const defaultState: SharePanelState = {
  peerId: "",
  signalUrl: "",
  shareUrl: "",
};

export class P2PLockstepSharePanelElement extends HTMLElement {
  #state: SharePanelState = defaultState;
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

  set state(value: SharePanelState) {
    this.#state = value;
    if (this.#ready) {
      this.render();
    }
  }

  get state() {
    return this.#state;
  }

  async render() {
    const { shareUrl } = this.#state;
    this.className = "block";
    this.innerHTML = `
      <section class="lock-panel flex h-full flex-col justify-between gap-3 rounded-[1.4rem] p-3.5 sm:gap-4 sm:rounded-[2rem] sm:p-5">
        <div class="flex items-center justify-between gap-3">
          <p class="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--lock-dim)] sm:text-[0.7rem]">Share</p>
          <span data-share-state class="lock-card rounded-full border border-[var(--lock-border)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--lock-muted)] sm:px-3 sm:py-1 sm:text-xs"></span>
        </div>

        <div class="flex flex-1 items-center justify-center">
          <div class="rounded-[1.1rem] border border-[var(--lock-border)] bg-white p-2.5 shadow-sm sm:rounded-[1.7rem] sm:p-4">
            <canvas class="h-40 w-40 rounded-xl bg-white sm:h-52 sm:w-52 sm:rounded-2xl"></canvas>
          </div>
        </div>

        <button
          type="button"
          data-action="copy-share"
          class="lock-primary lock-disabled inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition sm:py-4"
          ${shareUrl ? "" : "disabled"}
        >
          Share
        </button>
      </section>
    `;

    setText(this, "[data-share-state]", shareUrl ? "ready" : "waiting");

    const canvas = this.querySelector("canvas");
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!shareUrl) {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    try {
      await QRCode.toCanvas(canvas, shareUrl, {
        width: 208,
        margin: 1,
        color: {
          dark: "#1f1f1d",
          light: "#ffffff",
        },
      });
    } catch {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  #handleClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest("[data-action='copy-share']")) {
      return;
    }
    emit(this, "lockstep-copy-share", { value: this.#state.shareUrl });
  };
}
