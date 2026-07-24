import QRCode from "qrcode";
import type { JsonValue } from "p2p-lockstep-kit-multisession";
import {
  DEFAULT_DISPLAY_NAME,
  DEFAULT_SIGNAL_URL,
  DISPLAY_NAME_MAX_LENGTH,
} from "./config.js";
import { LiveTableController } from "./runtime/controller.js";
import type {
  MultiTableController,
  MultiTableView,
  MultiUiGame,
  MultiUiOptions,
  MultiUiRuntime,
} from "./types.js";
import { renderLobby } from "./components/lobby.js";
import { renderSessionPanel } from "./components/session-panel.js";
import { escapeHtml } from "./utils/html.js";
import {
  normalizeDisplayName,
  readStoredDisplayName,
  storeDisplayName,
} from "./utils/profile.js";
import {
  buildInvitationUrl,
  readHostPeerIdFromUrl,
} from "./utils/share.js";

type AnyGame = MultiUiGame<JsonValue, JsonValue, unknown, JsonValue>;
type AnyController = MultiTableController<JsonValue, JsonValue>;

export class P2PLockstepMultiAppElement extends HTMLElement {
  readonly #boardHost = document.createElement("div");
  #connected = false;
  #controller: AnyController | null = null;
  #unsubscribe: (() => void) | null = null;
  #view: MultiTableView<JsonValue> | null = null;
  #game: AnyGame | null = null;
  #setup: MultiUiOptions<JsonValue, JsonValue, unknown, JsonValue> | null = null;
  #locationHref = "";
  #displayName = DEFAULT_DISPLAY_NAME;
  #draftDisplayName = "";
  #editingDisplayName = false;
  #profileError: string | null = null;
  #busy = false;
  #error: string | null = null;
  #copyNotice: string | null = null;
  #copyNoticeTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  #invitationQrUrl: string | null = null;
  #invitationQrDataUrl: string | null = null;
  #invitationQrFailed = false;
  #screen: "landing" | "lobby" | "game" = "landing";

  constructor() {
    super();
    this.#boardHost.className = "multi-board-host";
    this.#boardHost.setAttribute("role", "region");
    this.#boardHost.setAttribute("aria-label", "游戏区域");
  }

  connectedCallback(): void {
    if (this.#connected) return;
    this.#connected = true;
    this.addEventListener("click", this.#handleClick);
    this.addEventListener("submit", this.#handleSubmit);
    this.#render();
  }

  disconnectedCallback(): void {
    if (!this.#connected) return;
    this.#connected = false;
    this.removeEventListener("click", this.#handleClick);
    this.removeEventListener("submit", this.#handleSubmit);
    this.dispose();
  }

  async configure<
    TCommand extends JsonValue,
    TEventPayload extends JsonValue,
    TGameState,
    TGameSnapshot extends JsonValue,
  >(
    options: MultiUiOptions<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >,
  ): Promise<MultiUiRuntime<TCommand, TGameSnapshot>> {
    this.#game = options.game as unknown as AnyGame;
    this.#locationHref =
      options.locationHref ?? globalThis.location?.href ?? "http://localhost/";
    const hostPeerId =
      options.hostPeerId === undefined
        ? readHostPeerIdFromUrl(this.#locationHref)
        : options.hostPeerId;
    this.#displayName =
      normalizeDisplayName(options.displayName) ??
      readStoredDisplayName() ??
      DEFAULT_DISPLAY_NAME;
    this.#draftDisplayName = this.#displayName;
    const setup: MultiUiOptions<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    > = {
      game: options.game,
      signalUrl: options.signalUrl ?? DEFAULT_SIGNAL_URL,
      hostPeerId,
      displayName: this.#displayName,
      locationHref: this.#locationHref,
    };
    this.#setup = setup as unknown as MultiUiOptions<
      JsonValue,
      JsonValue,
      unknown,
      JsonValue
    >;
    this.#busy = true;
    this.#error = null;
    this.#render();
    try {
      this.#unsubscribe?.();
      this.#controller?.dispose();
      const controller = await LiveTableController.create(setup);
      this.#controller = controller as unknown as AnyController;
      this.#unsubscribe = controller.subscribe((view) => {
        this.#view = view as unknown as MultiTableView<JsonValue>;
        this.#prepareInvitationQr(
          buildInvitationUrl(this.#locationHref, String(view.hostPeerId)),
        );
        this.#render();
      });
      return controller.runtime;
    } catch (error) {
      this.#error = errorMessage(error, "无法连接游戏网络");
      throw error;
    } finally {
      this.#busy = false;
      this.#render();
    }
  }

  getRuntime<
    TCommand extends JsonValue = JsonValue,
    TGameSnapshot extends JsonValue = JsonValue,
  >(): MultiUiRuntime<TCommand, TGameSnapshot> | null {
    return (this.#controller?.runtime as unknown as MultiUiRuntime<
      TCommand,
      TGameSnapshot
    >) ?? null;
  }

  getBoardHost(): HTMLElement {
    return this.#boardHost;
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#controller?.dispose();
    this.#controller = null;
    this.#view = null;
    if (this.#copyNoticeTimer !== null) {
      globalThis.clearTimeout(this.#copyNoticeTimer);
      this.#copyNoticeTimer = null;
    }
  }

  #handleClick = (event: MouseEvent): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-action]")
        : null;
    if (!target || !this.contains(target)) return;
    const controller = this.#controller;
    switch (target.dataset.action) {
      case "ready":
        if (controller) void this.#run(() => controller.ready());
        break;
      case "start":
        if (controller) void this.#run(() => controller.start());
        break;
      case "restart":
        if (controller) void this.#run(() => controller.restart());
        break;
      case "resume":
        if (controller) void this.#run(() => controller.resume());
        break;
      case "copy-host-peer":
        if (this.#view) {
          void this.#copyText(
            String(this.#view.hostPeerId),
            "房主 Peer ID 已复制",
          );
        }
        break;
      case "copy-invitation":
        if (this.#view) {
          void this.#copyText(
            buildInvitationUrl(
              this.#locationHref,
              String(this.#view.hostPeerId),
            ),
            "邀请链接已复制",
          );
        }
        break;
      case "edit-display-name":
        if (this.#view) {
          const participant = this.#view.snapshot.state.participants.get(
            this.#view.snapshot.state.localParticipantId,
          );
          this.#draftDisplayName =
            participant?.displayName ?? this.#displayName;
          this.#profileError = null;
          this.#editingDisplayName = true;
          this.#render();
        }
        break;
      case "cancel-display-name":
        this.#profileError = null;
        this.#editingDisplayName = false;
        this.#render();
        break;
      case "retry-connection":
        if (this.#setup) {
          void this.configure(this.#setup).catch(() => undefined);
        }
        break;
    }
  };

  #handleSubmit = (event: SubmitEvent): void => {
    if (
      !(event.target instanceof HTMLFormElement) ||
      event.target.dataset.form !== "display-name"
    ) {
      return;
    }
    event.preventDefault();
    const value = new FormData(event.target).get("displayName");
    this.#draftDisplayName = typeof value === "string" ? value : "";
    const displayName = normalizeDisplayName(value);
    if (!displayName) {
      this.#profileError = `请输入 1–${DISPLAY_NAME_MAX_LENGTH} 个字符的名称`;
      this.#render();
      return;
    }
    const controller = this.#controller;
    if (!controller) return;
    this.#profileError = null;
    void this.#run(async () => {
      await controller.setDisplayName(displayName);
      this.#displayName = displayName;
      this.#draftDisplayName = displayName;
      this.#editingDisplayName = false;
      storeDisplayName(displayName);
    });
  };

  async #run(action: () => Promise<void>): Promise<void> {
    this.#busy = true;
    this.#error = null;
    this.#render();
    try {
      await action();
    } catch (error) {
      this.#error = errorMessage(error, "操作失败");
    } finally {
      this.#busy = false;
      this.#render();
    }
  }

  #prepareInvitationQr(invitationUrl: string): void {
    if (this.#invitationQrUrl === invitationUrl) return;
    this.#invitationQrUrl = invitationUrl;
    this.#invitationQrDataUrl = null;
    this.#invitationQrFailed = false;
    void QRCode.toDataURL(invitationUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: { dark: "#1f1f1d", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (this.#invitationQrUrl !== invitationUrl) return;
        this.#invitationQrDataUrl = dataUrl;
        this.#render();
      })
      .catch(() => {
        if (this.#invitationQrUrl !== invitationUrl) return;
        this.#invitationQrFailed = true;
        this.#render();
      });
  }

  async #copyText(value: string, notice: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("clipboard unavailable");
      }
      this.#copyNotice = notice;
    } catch {
      this.#copyNotice = "复制失败，请手动选择文本";
    }
    this.#render();
    if (this.#copyNoticeTimer !== null) {
      globalThis.clearTimeout(this.#copyNoticeTimer);
    }
    this.#copyNoticeTimer = globalThis.setTimeout(() => {
      this.#copyNotice = null;
      this.#copyNoticeTimer = null;
      this.#render();
    }, 2200);
  }

  #render(): void {
    if (!this.#connected) return;
    const awaitingAdmission =
      this.#view !== null &&
      this.#view.snapshot.state.participants.size === 0 &&
      (this.#view.snapshot.state.phase === "invited" ||
        this.#view.snapshot.state.phase === "joining");
    if (!this.#view || !this.#controller || awaitingAdmission || !this.#game) {
      this.#screen = "landing";
      const joining =
        this.#setup?.hostPeerId !== null &&
        this.#setup?.hostPeerId !== undefined;
      const pending =
        this.#busy || this.#view?.snapshot.state.phase === "joining";
      const rejected =
        awaitingAdmission && this.#view?.snapshot.state.phase === "invited";
      const title =
        this.#error || rejected
          ? joining
            ? "未能加入游戏"
            : "未能连接游戏网络"
          : joining
            ? "正在加入游戏"
            : "正在准备游戏";
      const detail =
        this.#error ??
        (rejected
          ? "房主未接受加入，游戏可能已满或已经开始。"
          : joining
            ? "已从邀请链接识别房主，正在建立真实 P2P 连接。"
            : "正在注册本机 Peer；完成后会进入大厅等待其他玩家。");
      this.innerHTML = `<div class="multi-app-shell">
        ${this.#topbar(false)}
        <main class="connection-landing">
          <span class="brand-tile">${escapeHtml(this.#game?.mark ?? "游")}</span>
          <p>REAL P2P MULTIPLAYER</p>
          <h1>${escapeHtml(title)}</h1>
          <span>${escapeHtml(detail)}</span>
          ${pending ? '<small class="connection-progress">正在连接…</small>' : '<button type="button" class="button-primary" data-action="retry-connection">重新连接</button>'}
        </main>
      </div>`;
      return;
    }

    const inGame = this.#view.snapshot.game !== null;
    if (!inGame) {
      this.#screen = "lobby";
      this.innerHTML = `<div class="multi-app-shell">
        ${this.#topbar(false)}
        ${renderLobby(this.#view, {
          busy: this.#busy,
          copyNotice: this.#copyNotice,
          invitationUrl: buildInvitationUrl(
            this.#locationHref,
            String(this.#view.hostPeerId),
          ),
          invitationQrDataUrl: this.#invitationQrDataUrl,
          invitationQrFailed: this.#invitationQrFailed,
          displayNameEditor: {
            open: this.#editingDisplayName,
            value: this.#draftDisplayName,
            error: this.#profileError,
          },
          ...(this.#game.seatLabel
            ? { seatLabel: this.#game.seatLabel }
            : {}),
          ...(this.#game.eventLabel
            ? { eventLabel: this.#game.eventLabel }
            : {}),
        })}
      </div>`;
      return;
    }

    if (this.#screen !== "game") {
      this.#screen = "game";
      this.innerHTML = `<div class="multi-app-shell">
        <div data-multiui-topbar></div>
        <main class="game-layout">
          <section class="game-stage"><div data-multiui-board></div></section>
          <div data-multiui-session></div>
        </main>
      </div>`;
      this.querySelector("[data-multiui-board]")?.replaceWith(this.#boardHost);
    }
    const topbar = this.querySelector<HTMLElement>("[data-multiui-topbar]");
    if (topbar) topbar.outerHTML = this.#topbar(true);
    const session = this.querySelector<HTMLElement>("[data-multiui-session]");
    if (session) {
      session.innerHTML = renderSessionPanel(this.#view, {
        busy: this.#busy,
        ...(this.#game.seatLabel
          ? { seatLabel: this.#game.seatLabel }
          : {}),
        ...(this.#game.eventLabel
          ? { eventLabel: this.#game.eventLabel }
          : {}),
      });
    }
  }

  #topbar(inGame: boolean): string {
    const state = this.#view?.snapshot.state;
    const isOffline =
      state?.phase === "offline" || state?.phase === "syncing";
    const onlineCount = state
      ? [...state.participants.values()].filter(
          (participant) =>
            state.connections.get(participant.id) === "connected",
        ).length
      : 0;
    const total = state?.configuration.participantCount ?? 0;
    return `<header class="topbar" data-multiui-topbar>
      <div class="brand"><span class="brand-tile">${escapeHtml(this.#game?.mark ?? "游")}</span><strong>${escapeHtml(this.#game?.title ?? "多人游戏")}</strong></div>
      <div class="topbar-meta">${this.#view ? `<span>房主 · ${escapeHtml(String(this.#view.hostPeerId).slice(0, 8))}</span>` : ""}<span>${inGame ? "游戏进行中" : "等待开局"}</span>${state ? `<span>事件 #${state.lastAppliedSeq}</span>` : ""}</div>
      <div class="topbar-actions"><span class="network-health${isOffline ? " is-offline" : ""}"><i></i>${isOffline ? "全桌暂停" : state ? `在线 ${onlineCount}/${total}` : this.#busy ? "连接中" : "未连接"}</span></div>
    </header>`;
  }
}

const errorMessage = (reason: unknown, fallback: string): string =>
  reason instanceof Error ? reason.message : fallback;
