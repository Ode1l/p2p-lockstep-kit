export class P2PLockstepBoardHostElement extends HTMLElement {
  #ready = false;
  #observer: MutationObserver | null = null;
  #mount: HTMLDivElement | null = null;

  connectedCallback() {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    this.render();

    const mount = this.getMount();
    const placeholder = this.querySelector<HTMLElement>("[data-placeholder]");
    if (!mount || !placeholder) {
      return;
    }

    const syncPlaceholder = () => {
      placeholder.style.display = mount.childElementCount > 0 ? "none" : "flex";
    };

    syncPlaceholder();
    this.#observer = new MutationObserver(syncPlaceholder);
    this.#observer.observe(mount, { childList: true });
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  getMount() {
    if (!this.#ready) {
      this.connectedCallback();
    }
    return this.#mount;
  }

  render() {
    this.className = "block h-full";
    this.innerHTML = `
      <section class="relative h-full min-h-[15rem] overflow-visible rounded-[1.4rem] bg-transparent sm:min-h-[22rem] sm:rounded-[2.2rem] lg:min-h-[32rem] lg:rounded-[2rem]">
        <div data-board-mount class="relative z-10 h-full"></div>
        <div
          data-placeholder
          class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm leading-6 text-[var(--lock-muted)]"
        >
          Board host ready
        </div>
      </section>
    `;
    this.#mount = this.querySelector<HTMLDivElement>("[data-board-mount]");
  }
}
