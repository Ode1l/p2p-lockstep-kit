import { NetworkClient } from "p2p-lockstep-kit-network";
import { createSession } from "p2p-lockstep-kit-session";
import type { IGamePlugin } from "p2p-lockstep-kit-session";
import type {
  AppState,
  DialogState,
  GameRuntime,
  RuntimeObserver,
  SessionSnapshot,
  SessionStateView,
  ThemeMode,
  ToastState,
} from "./types";
import { DEFAULT_SIGNAL_URL } from "./config";
import { readShareLocation } from "./utils/share";
import type { P2PLockstepPairingPageElement } from "./pages/pairing-page";
import type { P2PLockstepGamePageElement } from "./pages/game-page";

const defaultState = (attrs?: {
  gameTitle?: string;
  sessionId?: string;
  signalUrl?: string;
  theme?: ThemeMode;
  allowDraw?: boolean;
  allowResign?: boolean;
}): AppState => ({
  screen: "pairing",
  theme: attrs?.theme || "light",
  gameTitle: attrs?.gameTitle || "P2P Lockstep",
  sessionId: attrs?.sessionId || "default-session",
  signalUrl: attrs?.signalUrl || DEFAULT_SIGNAL_URL,
  targetId: "",
  peerId: "",
  remotePeerId: "",
  connectionState: "idle",
  connected: false,
  registering: false,
  connecting: false,
  readySelf: false,
  readyPeer: false,
  canReady: false,
  canStart: false,
  canUndo: false,
  canRestart: false,
  canOfferDraw: false,
  canResign: false,
  allowDraw: attrs?.allowDraw ?? false,
  allowResign: attrs?.allowResign ?? false,
  started: false,
  currentTurn: 1,
  turnOwner: null,
  localState: "idle",
  remoteState: "idle",
  pendingAction: null,
  outcome: null,
  historyLength: 0,
  lastStart: null,
  lastError: "",
});

const THEME_STORAGE_KEY = "p2p-lockstep-theme";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "light" || value === "dark";

const readStoredTheme = (): ThemeMode | null => {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
};

const storeTheme = (theme: ThemeMode) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme persistence is optional when storage is unavailable.
  }
};

const defaultDialog: DialogState = {
  open: false,
  title: "",
  description: "",
  confirmLabel: "Approve",
  cancelLabel: "Reject",
};

const defaultToast: ToastState = {
  open: false,
  message: "",
};

const activeStates: SessionStateView[] = [
  "turn",
  "remote_turn",
  "approving",
  "waiting_approval",
  "syncing",
];

type SessionInstance = ReturnType<typeof createSession>;
type InternalObserver = RuntimeObserver & {
  onGameEvent: NonNullable<RuntimeObserver["onGameEvent"]>;
};

export class P2PLockstepAppElement extends HTMLElement {
  static get observedAttributes() {
    return [
      "game-title",
      "session-id",
      "signal-url",
      "theme",
      "allow-draw",
      "allow-resign",
    ];
  }

  #ready = false;
  #state: AppState = defaultState();
  #dialogState: DialogState = defaultDialog;
  #dialogAction: "approval" | "resign" | null = null;
  #toastState: ToastState = defaultToast;
  #pairingPage: P2PLockstepPairingPageElement | null = null;
  #gamePage: P2PLockstepGamePageElement | null = null;
  #dialog: (HTMLElement & { state: DialogState }) | null = null;
  #toast: (HTMLElement & { state: ToastState }) | null = null;
  #network = new NetworkClient();
  #session: SessionInstance | null = null;
  #runtime: GameRuntime | null = null;
  #toastTimer: number | null = null;
  #observer: InternalObserver | null = null;
  #pageWasHidden = false;
  #resumeRecovery: Promise<void> | null = null;

  connectedCallback() {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    const declaredTheme = isThemeMode(this.getAttribute("theme"))
      ? (this.getAttribute("theme") as ThemeMode)
      : "light";
    const theme = readStoredTheme() ?? declaredTheme;
    this.#state = defaultState({
      gameTitle: this.getAttribute("game-title") ?? undefined,
      sessionId: this.getAttribute("session-id") ?? undefined,
      signalUrl: this.getAttribute("signal-url") ?? undefined,
      theme,
      allowDraw: this.hasAttribute("allow-draw"),
      allowResign: this.hasAttribute("allow-resign"),
    });
    if (this.getAttribute("theme") !== theme) {
      this.setAttribute("theme", theme);
    }
    this.render();
    this.addEventListener(
      "lockstep-register",
      this.#handleRegisterEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-connect",
      this.#handleConnectEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-signal-change",
      this.#handleSignalChangeEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-target-change",
      this.#handleTargetChangeEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-share-detected",
      this.#handleShareDetectedEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-copy-share",
      this.#handleCopyShareEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-theme-change",
      this.#handleThemeChangeEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-ready",
      this.#handleReadyEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-start",
      this.#handleStartEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-undo",
      this.#handleUndoEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-restart",
      this.#handleRestartEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-draw",
      this.#handleDrawEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-resign",
      this.#handleResignEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-dialog-confirm",
      this.#handleDialogConfirmEvent as EventListener,
    );
    this.addEventListener(
      "lockstep-dialog-cancel",
      this.#handleDialogCancelEvent as EventListener,
    );
    document.addEventListener("visibilitychange", this.#handleVisibilityChange);
    window.addEventListener("pageshow", this.#handlePageShow);
    this.#initializeSession();
    void this.#bootstrapFromLocation();
  }

  disconnectedCallback() {
    this.removeEventListener(
      "lockstep-register",
      this.#handleRegisterEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-connect",
      this.#handleConnectEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-signal-change",
      this.#handleSignalChangeEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-target-change",
      this.#handleTargetChangeEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-share-detected",
      this.#handleShareDetectedEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-copy-share",
      this.#handleCopyShareEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-theme-change",
      this.#handleThemeChangeEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-ready",
      this.#handleReadyEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-start",
      this.#handleStartEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-undo",
      this.#handleUndoEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-restart",
      this.#handleRestartEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-draw",
      this.#handleDrawEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-resign",
      this.#handleResignEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-dialog-confirm",
      this.#handleDialogConfirmEvent as EventListener,
    );
    this.removeEventListener(
      "lockstep-dialog-cancel",
      this.#handleDialogCancelEvent as EventListener,
    );
    document.removeEventListener(
      "visibilitychange",
      this.#handleVisibilityChange,
    );
    window.removeEventListener("pageshow", this.#handlePageShow);
    if (this.#toastTimer) {
      window.clearTimeout(this.#toastTimer);
      this.#toastTimer = null;
    }
    this.#network.disconnect();
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null,
  ) {
    if (!this.#ready) {
      return;
    }
    if (name === "game-title" && newValue) {
      this.#patchState({ gameTitle: newValue });
    }
    if (name === "session-id" && newValue) {
      this.#patchState({ sessionId: newValue });
    }
    if (name === "signal-url" && newValue) {
      this.#patchState({ signalUrl: newValue });
    }
    if (name === "theme" && isThemeMode(newValue)) {
      this.#patchState({ theme: newValue });
    }
    if (name === "allow-draw") {
      this.#patchState({ allowDraw: newValue !== null });
    }
    if (name === "allow-resign") {
      this.#patchState({ allowResign: newValue !== null });
    }
  }

  getRuntime(): GameRuntime | null {
    return this.#runtime;
  }

  resumeConnection() {
    this.#recoverAfterPageResume();
  }

  getBoardHost() {
    return this.#gamePage?.getBoardHost() ?? null;
  }

  render() {
    this.className =
      "block min-h-svh bg-[var(--lock-bg-deep)] text-[var(--lock-paper)]";
    this.innerHTML = `
      <div class="lock-app-bg relative min-h-svh overflow-hidden">
        <div class="lock-grid-bg pointer-events-none absolute inset-0 hidden opacity-[0.45] sm:block"></div>

        <main class="relative mx-auto flex min-h-svh max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <header class="lock-panel lock-enter mb-5 hidden flex-wrap items-center justify-between gap-4 rounded-[1.25rem] px-4 py-3 sm:flex">
            <div class="flex items-center gap-3">
              <div>
                <p class="text-sm font-semibold text-[var(--lock-paper)]">${this.#state.gameTitle}</p>
                <p class="text-xs text-[var(--lock-muted)]">direct peer match</p>
              </div>
            </div>
            <div data-shell-connection-state class="lock-control rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--lock-muted)]">
              ${this.#state.connectionState}
            </div>
          </header>

          <div class="flex-1 lock-enter">
            <p2p-lockstep-pairing-page ${this.#state.screen === "pairing" ? "" : "hidden"}></p2p-lockstep-pairing-page>
            <p2p-lockstep-game-page ${this.#state.screen === "game" ? "" : "hidden"}></p2p-lockstep-game-page>
          </div>
        </main>

        <p2p-lockstep-confirm-dialog></p2p-lockstep-confirm-dialog>
        <p2p-lockstep-toast-message></p2p-lockstep-toast-message>
      </div>
    `;

    this.#pairingPage = this.querySelector("p2p-lockstep-pairing-page");
    this.#gamePage = this.querySelector("p2p-lockstep-game-page");
    this.#dialog = this.querySelector("p2p-lockstep-confirm-dialog");
    this.#toast = this.querySelector("p2p-lockstep-toast-message");

    this.#syncUi();
  }

  #initializeSession() {
    this.#session = createSession(this.#network, this.#state.sessionId);

    this.#runtime = {
      setGamePlugin: (plugin: IGamePlugin) =>
        this.#session?.state.setGamePlugin(plugin),
      actions: {
        move: (data: unknown) => this.#session?.actions.move(data),
        offerDraw: () => this.#session?.actions.offerDraw(),
        resign: () => this.#session?.actions.resign(),
      },
      observer: {
        subscribe: (observer: RuntimeObserver) =>
          this.#session?.observer.subscribe({
            onStateChange: observer.onStateChange,
            onConnectionChange: observer.onConnectionChange,
            onError: observer.onError,
            onGameEvent: observer.onGameEvent ?? (() => {}),
          }) ?? (() => {}),
        getSnapshot: () =>
          (this.#session?.observer.getSnapshot() as SessionSnapshot | null) ??
          null,
      },
    };

    this.#observer = {
      onStateChange: (snapshot) => this.#applySnapshot(snapshot),
      onConnectionChange: (connected) => this.#applyConnectionState(connected),
      onGameEvent: () => {},
      onError: (error) => {
        this.#patchState({
          lastError: error.message,
          connectionState: "error",
        });
        this.#showToast(error.message);
      },
    };

    this.#session.observer.subscribe(this.#observer);
    this.#patchState({
      localState: "idle",
      remoteState: "idle",
      currentTurn: 1,
    });
  }

  async #bootstrapFromLocation() {
    const shared = readShareLocation();
    if (shared.signalUrl) {
      this.#patchState({ signalUrl: shared.signalUrl });
    }
    if (shared.peerId) {
      this.#patchState({ targetId: shared.peerId });
    }

    if (!this.#state.signalUrl) {
      return;
    }

    await this.#register(this.#state.signalUrl, true);
    if (shared.peerId) {
      await this.#connect(shared.peerId, true);
    }
  }

  #recoverAfterPageResume() {
    if (this.#resumeRecovery || !this.isConnected) {
      return;
    }

    const shared = readShareLocation();
    const remotePeerId =
      this.#network.getRemotePeerId() ||
      this.#state.remotePeerId ||
      shared.peerId;

    if (
      this.#state.screen !== "game" ||
      !this.#state.signalUrl ||
      !remotePeerId
    ) {
      return;
    }

    this.#resumeRecovery = this.#reconnectAfterPageResume(remotePeerId).finally(
      () => {
        this.#resumeRecovery = null;
      },
    );
  }

  async #reconnectAfterPageResume(remotePeerId: string) {
    this.#patchState({
      targetId: remotePeerId,
      remotePeerId,
      connected: false,
      connecting: true,
      connectionState: "connecting",
      lastError: "",
    });
    this.#showToast("Restoring peer connection.");

    await this.#register(this.#state.signalUrl, true);
    if (!this.#network.getLocalPeerId()) {
      return;
    }
    await this.#connect(remotePeerId, true);
  }

  async #register(signalUrl: string, quiet = false) {
    const trimmed = signalUrl.trim();
    if (!trimmed) {
      return;
    }

    this.#patchState({
      signalUrl: trimmed,
      registering: true,
      connectionState: "registering",
      lastError: "",
    });

    try {
      const { peerId } = await this.#network.register(trimmed);
      this.#session?.net.setPeerIds({
        local: peerId,
        remote: this.#state.remotePeerId || null,
      });
      this.#patchState({
        peerId,
        registering: false,
        connectionState: "registered",
      });
      if (!quiet) {
        this.#showToast("Peer registered. You can share the link now.");
      }
    } catch (error) {
      this.#patchState({
        registering: false,
        connectionState: "error",
        lastError:
          error instanceof Error
            ? error.message
            : "Failed to register signaling session.",
      });
      this.#showToast(
        this.#state.lastError || "Failed to register signaling session.",
      );
    }
  }

  async #connect(targetId: string, quiet = false) {
    const trimmed = targetId.trim();
    if (!trimmed) {
      return;
    }

    if (!this.#state.peerId && this.#state.signalUrl) {
      await this.#register(this.#state.signalUrl, true);
    }

    this.#patchState({
      targetId: trimmed,
      remotePeerId: trimmed,
      connecting: true,
      connectionState: "connecting",
      lastError: "",
    });
    this.#session?.net.setPeerIds({
      local: this.#state.peerId || null,
      remote: trimmed,
    });

    try {
      await this.#network.connect(trimmed);
      this.#patchState({ connecting: false });
      if (!quiet) {
        this.#showToast("Connection request sent.");
      }
    } catch (error) {
      this.#patchState({
        connecting: false,
        connectionState: "error",
        lastError:
          error instanceof Error
            ? error.message
            : "Failed to start peer connection.",
      });
      this.#showToast(
        this.#state.lastError || "Failed to start peer connection.",
      );
    }
  }

  #applySnapshot(snapshot: SessionSnapshot) {
    const snapshotConnected = snapshot.connected;
    const readySelf = snapshot.localState === "ready";
    const readyPeer = snapshot.remoteState === "ready";
    const matchActive =
      !snapshot.outcome &&
      (snapshot.localState === "turn" ||
        snapshot.localState === "remote_turn");
    const canReady = snapshotConnected && snapshot.localState === "idle";
    const canStart = snapshotConnected && snapshot.localState === "could_start";
    const canUndo =
      snapshotConnected &&
      matchActive &&
      !snapshot.pendingAction &&
      snapshot.history.length > 0;
    const canRestart =
      snapshotConnected &&
      matchActive &&
      !snapshot.pendingAction;
    const canOfferDraw =
      this.#state.allowDraw &&
      snapshotConnected &&
      matchActive &&
      !snapshot.pendingAction;
    const canResign =
      this.#state.allowResign &&
      snapshotConnected &&
      matchActive &&
      !snapshot.pendingAction;
    const started =
      activeStates.includes(snapshot.localState) ||
      (snapshot.localState === "offline" && snapshot.lastStart !== null);
    const turnOwner =
      snapshot.localState === "turn"
        ? "me"
        : snapshot.localState === "remote_turn"
          ? "peer"
          : null;

    this.#patchState({
      readySelf,
      readyPeer,
      connected: snapshotConnected,
      connectionState: snapshotConnected
        ? "connected"
        : this.#state.connectionState,
      canReady,
      canStart,
      canUndo,
      canRestart,
      canOfferDraw,
      canResign,
      screen: snapshotConnected ? "game" : this.#state.screen,
      started,
      currentTurn: snapshot.turn,
      turnOwner,
      localState: snapshot.localState,
      remoteState: snapshot.remoteState,
      pendingAction: snapshot.pendingAction,
      outcome: snapshot.outcome,
      historyLength: snapshot.history.length,
      lastStart: snapshot.lastStart,
    });

    if (snapshot.localState === "approving" && snapshot.pendingAction) {
      this.#dialogAction = "approval";
      const copy =
        snapshot.pendingAction === "undo"
          ? {
              title: "Undo request pending",
              description:
                "Your peer wants to roll the match back. Approve the undo or reject it and keep the current board.",
            }
          : snapshot.pendingAction === "restart"
            ? {
                title: "Restart request pending",
                description:
                  "Your peer wants to restart the match. Approve to reset the board shell or reject to continue.",
              }
            : {
                title: "Draw offer",
                description:
                  "Your peer has offered a draw. Accept to end the match as a draw or reject to continue playing.",
              };
      this.#dialogState = {
        open: true,
        ...copy,
        confirmLabel:
          snapshot.pendingAction === "draw" ? "Accept draw" : "Approve",
        cancelLabel: "Reject",
      };
    } else if (this.#dialogAction === "approval") {
      this.#dialogState = defaultDialog;
      this.#dialogAction = null;
    }

    this.#syncUi();
  }

  #applyConnectionState(connected: boolean) {
    const wasOnGameScreen = this.#state.screen === "game";
    const peerState = this.#network.peerState();
    const remotePeerId =
      this.#network.getRemotePeerId() ?? this.#state.remotePeerId;
    const peerId = this.#network.getLocalPeerId() ?? this.#state.peerId;
    const shouldShowGame = connected || wasOnGameScreen;

    const connectionState =
      peerState === "connected"
        ? "connected"
        : peerState === "requesting"
          ? "connecting"
          : wasOnGameScreen
            ? "offline"
            : peerId
              ? "registered"
              : "idle";

    this.#patchState({
      peerId,
      remotePeerId,
      connected,
      connecting: peerState === "requesting",
      connectionState,
      screen: shouldShowGame ? "game" : "pairing",
    });

    if (connected) {
      this.#showToast("Peer connected. Game page is live.");
    } else if (peerState === "requesting" && !wasOnGameScreen) {
      this.#showToast("Connecting to peer.");
    } else if (wasOnGameScreen && peerId) {
      this.#showToast("Peer disconnected. Waiting for reconnect.");
    }
  }

  #patchState(next: Partial<AppState>) {
    this.#state = {
      ...this.#state,
      ...next,
    };
    if (this.#ready) {
      this.#syncUi();
    }
  }

  #syncUi() {
    const pairing = this.#pairingPage;
    const game = this.#gamePage;
    const dialog = this.#dialog;
    const toast = this.#toast;
    if (!pairing || !game || !dialog || !toast) {
      return;
    }

    pairing.toggleAttribute("hidden", this.#state.screen !== "pairing");
    game.toggleAttribute("hidden", this.#state.screen !== "game");
    const shellConnectionState = this.querySelector<HTMLElement>(
      "[data-shell-connection-state]",
    );
    if (shellConnectionState) {
      shellConnectionState.textContent = this.#state.connectionState;
    }

    pairing.state = {
      theme: this.#state.theme,
      gameTitle: this.#state.gameTitle,
      signalUrl: this.#state.signalUrl,
      targetId: this.#state.targetId,
      peerId: this.#state.peerId,
      remotePeerId: this.#state.remotePeerId,
      connectionState: this.#state.connectionState,
      registering: this.#state.registering,
      connecting: this.#state.connecting,
    };

    game.state = {
      theme: this.#state.theme,
      gameTitle: this.#state.gameTitle,
      peerId: this.#state.peerId,
      remotePeerId: this.#state.remotePeerId,
      connected: this.#state.connected,
      connectionState: this.#state.connectionState,
      readySelf: this.#state.readySelf,
      readyPeer: this.#state.readyPeer,
      canReady: this.#state.canReady,
      canStart: this.#state.canStart,
      canUndo: this.#state.canUndo,
      canRestart: this.#state.canRestart,
      canOfferDraw: this.#state.canOfferDraw,
      canResign: this.#state.canResign,
      allowDraw: this.#state.allowDraw,
      allowResign: this.#state.allowResign,
      started: this.#state.started,
      currentTurn: this.#state.currentTurn,
      turnOwner: this.#state.turnOwner,
      localState: this.#state.localState,
      remoteState: this.#state.remoteState,
      pendingAction: this.#state.pendingAction,
      outcome: this.#state.outcome,
      sessionId: this.#state.sessionId,
      historyLength: this.#state.historyLength,
      lastStart: this.#state.lastStart,
      lastError: this.#state.lastError,
    };

    dialog.state = this.#dialogState;
    toast.state = this.#toastState;
  }

  #showToast(message: string) {
    if (!message) {
      return;
    }
    if (this.#toastTimer) {
      window.clearTimeout(this.#toastTimer);
    }
    this.#toastState = {
      open: true,
      message,
    };
    this.#syncUi();
    this.#toastTimer = window.setTimeout(() => {
      this.#toastState = defaultToast;
      this.#syncUi();
      this.#toastTimer = null;
    }, 2200);
  }

  async #copyText(value: string) {
    if (!value) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        this.#showToast("Copied to clipboard.");
        return;
      }
    } catch {
      // fall through to prompt
    }
    window.prompt("Copy value", value);
  }

  #handleRegisterEvent = (event: CustomEvent<{ signalUrl: string }>) => {
    void this.#register(event.detail.signalUrl);
  };

  #handleConnectEvent = (event: CustomEvent<{ targetId: string }>) => {
    void this.#connect(event.detail.targetId);
  };

  #handleSignalChangeEvent = (event: CustomEvent<{ signalUrl: string }>) => {
    this.#patchState({ signalUrl: event.detail.signalUrl });
  };

  #handleTargetChangeEvent = (event: CustomEvent<{ targetId: string }>) => {
    this.#patchState({ targetId: event.detail.targetId });
  };

  #handleShareDetectedEvent = (
    event: CustomEvent<{ peerId: string; signalUrl: string }>,
  ) => {
    this.#patchState({
      targetId: event.detail.peerId,
      signalUrl: event.detail.signalUrl || this.#state.signalUrl,
    });
  };

  #handleCopyShareEvent = (event: CustomEvent<{ value: string }>) => {
    void this.#copyText(event.detail.value);
  };

  #handleThemeChangeEvent = (event: CustomEvent<{ theme: ThemeMode }>) => {
    if (
      !isThemeMode(event.detail.theme) ||
      event.detail.theme === this.#state.theme
    ) {
      return;
    }
    const theme = event.detail.theme;
    storeTheme(theme);
    this.setAttribute("theme", theme);
    this.#showToast(`${theme === "dark" ? "Night" : "Day"} mode enabled.`);
  };

  #handleReadyEvent = () => {
    this.#session?.actions.ready();
    this.#showToast(
      this.#state.readySelf ? "Ready state cleared." : "Ready state sent.",
    );
  };

  #handleStartEvent = () => {
    this.#session?.actions.start();
    this.#showToast("Start request sent.");
  };

  #handleUndoEvent = () => {
    this.#session?.actions.undo();
    this.#showToast("Undo request sent.");
  };

  #handleRestartEvent = () => {
    this.#session?.actions.restart();
    this.#showToast("Restart request sent.");
  };

  #handleDrawEvent = () => {
    if (!this.#state.canOfferDraw) return;
    this.#session?.actions.offerDraw();
    this.#showToast("Draw offer sent.");
  };

  #handleResignEvent = () => {
    if (!this.#state.canResign) return;
    this.#dialogAction = "resign";
    this.#dialogState = {
      open: true,
      title: "Resign this match?",
      description:
        "Resigning ends the current match immediately and awards the win to your peer.",
      confirmLabel: "Resign",
      cancelLabel: "Keep playing",
    };
    this.#syncUi();
  };

  #handleDialogConfirmEvent = () => {
    if (this.#dialogAction === "resign") {
      this.#session?.actions.resign();
      this.#showToast("You resigned the match.");
    } else {
      this.#session?.actions.approve();
      this.#showToast("Request approved.");
    }
    this.#dialogAction = null;
    this.#dialogState = defaultDialog;
    this.#syncUi();
  };

  #handleDialogCancelEvent = () => {
    if (this.#dialogAction === "approval") {
      this.#session?.actions.reject();
      this.#showToast("Request rejected.");
    }
    this.#dialogAction = null;
    this.#dialogState = defaultDialog;
    this.#syncUi();
  };

  #handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      this.#pageWasHidden = true;
      return;
    }
    if (!this.#pageWasHidden) {
      return;
    }
    this.#pageWasHidden = false;
    this.#recoverAfterPageResume();
  };

  #handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      this.#recoverAfterPageResume();
    }
  };
}
