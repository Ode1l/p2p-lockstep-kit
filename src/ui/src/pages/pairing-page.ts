import type { PairingPageState, SharePanelState } from "../types";
import { setInputValue, setText } from "../utils/dom";
import { emit } from "../utils/events";
import { buildShareUrl, parseShareInput } from "../utils/share";

const defaultState: PairingPageState = {
  theme: "light",
  gameTitle: "P2P Lockstep",
  signalUrl: "",
  targetId: "",
  peerId: "",
  remotePeerId: "",
  connectionState: "idle",
  registering: false,
  connecting: false,
};

export class P2PLockstepPairingPageElement extends HTMLElement {
  #state: PairingPageState = defaultState;
  #ready = false;
  #rendered = false;

  connectedCallback() {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    this.addEventListener("click", this.#handleClick);
    this.addEventListener("input", this.#handleInput);
    this.render();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
    this.removeEventListener("input", this.#handleInput);
  }

  set state(value: PairingPageState) {
    const wasRendered = this.#rendered;
    this.#state = value;
    if (this.#ready && !wasRendered) {
      this.render();
    }
    if (this.#ready && wasRendered) {
      this.#syncState();
    }
  }

  get state() {
    return this.#state;
  }

  render() {
    this.className = "block";
    this.innerHTML = `
      <section class="mx-auto grid min-h-full max-w-5xl gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="lock-panel rounded-[1.4rem] p-3.5 sm:rounded-[2rem] sm:p-6 lg:p-7">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--lock-dim)] sm:text-[0.68rem]">Peer connection</p>
              <h1 data-game-title class="mt-1.5 break-words text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--lock-paper)] sm:mt-3 sm:text-5xl lg:text-6xl"></h1>
            </div>

            <details class="group relative shrink-0">
              <summary
                aria-label="Server settings"
                class="lock-control flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--lock-border)] text-base font-semibold leading-none text-[var(--lock-muted)] transition hover:border-[var(--lock-border-strong)] sm:h-10 sm:w-10 sm:text-lg [&::-webkit-details-marker]:hidden"
              >
                ...
              </summary>
              <div class="lock-surface-strong absolute right-0 z-20 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-[1.2rem] border border-[var(--lock-border-strong)] p-3.5 shadow-xl shadow-black/10 backdrop-blur-xl sm:mt-3 sm:rounded-[1.6rem] sm:p-4">
                <div class="lock-card mb-3 rounded-2xl border border-[var(--lock-border)] p-3">
                  <p class="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--lock-dim)]">Appearance</p>
                  <div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Color mode">
                    <button type="button" data-action="theme" data-theme-mode="light" class="lock-theme-option rounded-xl px-3 py-2 text-xs font-semibold" aria-label="Use day mode">Day</button>
                    <button type="button" data-action="theme" data-theme-mode="dark" class="lock-theme-option rounded-xl px-3 py-2 text-xs font-semibold" aria-label="Use night mode">Night</button>
                  </div>
                </div>

                <label class="block">
                  <span class="mb-2 block text-xs uppercase tracking-[0.22em] text-[var(--lock-dim)]">Signaling server</span>
                  <input
                    data-field="signal-url"
                    placeholder="wss://host"
                    class="lock-input lock-mono w-full rounded-2xl px-4 py-3 text-sm transition"
                  />
                </label>

                <button
                  type="button"
                  data-action="register"
                  class="lock-primary lock-disabled mt-3 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition"
                >
                  <span data-register-label></span>
                </button>
              </div>
            </details>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2 sm:mt-7 sm:gap-4">
            <section class="lock-card rounded-[1rem] border border-[var(--lock-border)] p-3 sm:rounded-[1.4rem] sm:p-4">
              <p class="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--lock-dim)] sm:text-[0.68rem]">Server</p>
              <div class="mt-2 flex items-center gap-2 sm:mt-3 sm:gap-3">
                <span data-status-dot class="h-2.5 w-2.5 rounded-full bg-slate-600"></span>
                <span data-connection-state class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lock-paper)] sm:text-sm"></span>
              </div>
            </section>

            <section class="lock-card rounded-[1rem] border border-[var(--lock-border)] p-3 sm:rounded-[1.4rem] sm:p-4">
              <div class="flex items-center justify-between gap-2">
                <p class="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--lock-dim)] sm:text-[0.68rem]">Your ID</p>
                <button type="button" data-action="copy-peer" class="lock-secondary lock-disabled rounded-full px-2.5 py-1 text-[0.62rem] font-semibold" aria-label="Copy your peer ID">Copy</button>
              </div>
              <p data-peer-id class="lock-mono mt-2 max-h-9 min-h-4 overflow-hidden break-all text-[0.68rem] leading-[1.35] text-[var(--lock-paper)] sm:mt-3 sm:max-h-none sm:text-sm"></p>
            </section>
          </div>

          <section class="lock-card mt-3 rounded-[1.1rem] border border-[var(--lock-border)] p-3 sm:mt-5 sm:rounded-[1.8rem] sm:p-5">
            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold text-[var(--lock-muted)] sm:mb-2 sm:text-sm">Peer ID or share link</span>
              <input
                data-field="target-id"
                placeholder="Paste peer id"
                class="lock-input lock-mono w-full rounded-xl px-3 py-3 text-sm transition sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
              />
            </label>

            <button
              type="button"
              data-action="connect"
              class="lock-primary lock-disabled mt-3 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition sm:mt-4 sm:py-4"
            >
              <span data-connect-label></span>
            </button>
          </section>
        </div>

        <p2p-lockstep-share-panel></p2p-lockstep-share-panel>
      </section>
    `;
    this.#rendered = true;
    this.#syncState();
  }

  #syncState() {
    setText(this, "[data-game-title]", this.#state.gameTitle);
    setText(this, "[data-connection-state]", this.#state.connectionState);
    setText(this, "[data-register-label]", this.#state.registering ? "Registering..." : "Register peer");
    setText(this, "[data-connect-label]", this.#state.connecting ? "Connecting..." : "Connect");
    setText(this, "[data-peer-id]", this.#state.peerId || "Register first to get your peer ID.");

    setInputValue(this, "[data-field='signal-url']", this.#state.signalUrl);
    setInputValue(this, "[data-field='target-id']", this.#state.targetId);

    const registerButton = this.querySelector<HTMLButtonElement>("[data-action='register']");
    if (registerButton) {
      registerButton.disabled = this.#state.registering || !this.#state.signalUrl.trim();
    }

    this.querySelectorAll<HTMLButtonElement>("[data-theme-mode]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.themeMode === this.#state.theme),
      );
    });

    const statusDot = this.querySelector<HTMLElement>("[data-status-dot]");
    if (statusDot) {
      const tone =
        this.#state.connectionState === "registered" || this.#state.connectionState === "connected"
          ? "bg-[var(--lock-teal)]"
        : this.#state.connectionState === "registering" ||
              this.#state.connectionState === "connecting"
            ? "bg-[#c08a25]"
            : this.#state.connectionState === "error" || this.#state.connectionState === "offline"
              ? "bg-[var(--lock-rose)]"
              : "bg-[var(--lock-dim)]";
      statusDot.className = `h-3 w-3 rounded-full ${tone}`;
    }

    const connectButton = this.querySelector<HTMLButtonElement>("[data-action='connect']");
    if (connectButton) {
      connectButton.disabled = this.#state.connecting || !this.#state.targetId.trim();
    }

    const copyPeerButton = this.querySelector<HTMLButtonElement>("[data-action='copy-peer']");
    if (copyPeerButton) {
      copyPeerButton.disabled = !this.#state.peerId;
    }

    const sharePanel = this.querySelector("p2p-lockstep-share-panel") as
      | (HTMLElement & { state: SharePanelState })
      | null;
    if (sharePanel) {
      sharePanel.state = {
        peerId: this.#state.peerId,
        signalUrl: this.#state.signalUrl,
        shareUrl: buildShareUrl(this.#state.peerId, this.#state.signalUrl),
      };
    }
  }

  #handleClick = (event: Event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      "button[data-action]",
    );
    if (!target || target.disabled) {
      return;
    }

    if (target.dataset.action === "register") {
      emit(this, "lockstep-register", { signalUrl: this.#state.signalUrl.trim() });
    }

    if (target.dataset.action === "connect") {
      emit(this, "lockstep-connect", { targetId: this.#state.targetId.trim() });
    }

    if (target.dataset.action === "copy-peer") {
      emit(this, "lockstep-copy-share", { value: this.#state.peerId });
    }

    if (
      target.dataset.action === "theme" &&
      (target.dataset.themeMode === "light" || target.dataset.themeMode === "dark")
    ) {
      emit(this, "lockstep-theme-change", { theme: target.dataset.themeMode });
    }
  };

  #handleInput = (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    if (!input?.dataset.field) {
      return;
    }

    if (input.dataset.field === "signal-url") {
      emit(this, "lockstep-signal-change", { signalUrl: input.value });
      return;
    }

    if (input.dataset.field === "target-id") {
      const parsed = parseShareInput(input.value);
      if (parsed) {
        emit(this, "lockstep-share-detected", parsed);
        return;
      }
      emit(this, "lockstep-target-change", { targetId: input.value });
    }
  };
}
