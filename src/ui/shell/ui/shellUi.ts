import QRCode from "qrcode";
import { createPanel } from "./panel";
import { createStyles } from "./styles";
import { createShellLayout } from "./layout";
import { createShellRequests } from "./requests";

type PanelInfo = {
  peerId: string;
  connected: boolean;
  gameTitle: string;
  readySelf: boolean;
  readyPeer: boolean;
  started: boolean;
  myColor: 1 | 2 | null;
  currentTurn: number;
  currentPlayer: 1 | 2;
  hasCache: boolean;
};

export type ShellUiBundle = {
  elements: {
    container: HTMLDivElement;
    boardWrap: HTMLDivElement;
  };
  panel: ReturnType<typeof createPanel>;
  controls: {
    bindEvents: (events: {
      onReady: (ready?: boolean) => Promise<void> | void;
      onStart: () => Promise<void> | void;
      onUndo: () => Promise<void> | void;
      onRestart: () => Promise<void> | void;
    }) => void;
  };
  updatePanel: (info: PanelInfo) => void;
  shareLink: (options: { peerId: string; signalUrl: string; title?: string }) => Promise<void>;
  getPeerId: () => string;
  log: (message: string) => void;
  promptUndo: () => Promise<boolean>;
  promptRestart: () => Promise<boolean>;
  promptRejoinChoice: () => Promise<"rejoin" | "restart">;
  promptRejoinApprove: () => Promise<boolean>;
  showStart: () => void;
  showWinner: (winner: 0 | 1 | 2) => void;
  showNotice: (message: string) => void;
};

export const createShellUi = (options?: { defaultSignalUrl?: string }): ShellUiBundle => {
  createStyles();

  const panel = createPanel();
  if (options?.defaultSignalUrl) {
    panel.refs.signalUrl.value = options.defaultSignalUrl;
  }

  const layout = createShellLayout(panel);
  const { showRequest, showWinner, showNotice, hideAll } = createShellRequests(layout);
  const {
    container,
    boardWrap,
    boardColumn,
    statusRow,
    actionsRow,
    configModal,
    configInput,
    configSave,
    configCancel,
    statusColor,
    statusTurn,
    readyBtn,
    startBtn,
    undoBtn,
    restartBtn,
    logPanel,
    logBody,
  } = layout;

  let lastPeerId = "";
  let lastMyColor: 1 | 2 | null = null;

  const buildShareUrl = (peerId: string, signalUrl: string) => {
    const url = new URL(window.location.href);
    const shareParams = new URLSearchParams();
    shareParams.set("id", peerId);
    shareParams.set("url", signalUrl);
    url.hash = shareParams.toString();
    return url.toString();
  };

  const parseShareInput = (value: string) => {
    const raw = value.trim();
    if (!raw || !raw.includes("://")) {
      return null;
    }
    try {
      const url = new URL(raw);
      const hash = url.hash.replace(/^#/, "");
      const params = new URLSearchParams(hash || url.search);
      const peerId = params.get("id");
      const signalUrl = params.get("url");
      if (!peerId) {
        return null;
      }
      return { peerId, signalUrl: signalUrl ?? "" };
    } catch {
      return null;
    }
  };

  const updateQr = async () => {
    const peerId = lastPeerId;
    const signalUrl = panel.refs.signalUrl.value;
    const canvas = panel.refs.shareQr;
    const ctx = canvas.getContext("2d");
    if (!peerId || peerId === "-") {
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const shareUrl = buildShareUrl(peerId, signalUrl);
    try {
      const size = Math.max(160, Math.floor(canvas.getBoundingClientRect().width));
      await QRCode.toCanvas(canvas, shareUrl, { width: size, margin: 1 });
    } catch (err) {
      console.log("[shell-ui] QR render failed", err);
    }
  };

  const updatePanel = (info: PanelInfo) => {
    lastPeerId = info.peerId || "";
    panel.refs.gameTitle.textContent = info.gameTitle || "-";
    panel.refs.gameSubtitle.textContent = `ID: ${info.peerId || "-"}`;
    const showBoard = info.connected;
    if (showBoard) {
      container.classList.remove("single");
    } else {
      container.classList.add("single");
    }
    boardColumn.style.display = showBoard ? "flex" : "none";
    boardWrap.style.display = showBoard ? "block" : "none";
    statusRow.style.display = showBoard ? "flex" : "none";
    actionsRow.style.display = showBoard ? "flex" : "none";
    if (!showBoard) {
      hideAll();
    }

    panel.refs.root.style.display = showBoard ? "none" : "grid";
    panel.refs.configButton.style.display = showBoard ? "none" : "grid";
    if (showBoard) {
      configModal.classList.add("hidden");
      panel.refs.joinCard.style.display = "none";
      panel.refs.shareCard.style.display = "none";
    } else {
      panel.refs.joinCard.style.display = "grid";
      panel.refs.shareCard.style.display = "grid";
    }

    lastMyColor = info.myColor;
    const colorLabel = info.started
      ? info.myColor === 1
        ? "Black"
        : info.myColor === 2
          ? "White"
          : "-"
      : "-";
    const turnLabel = info.started ? (info.currentPlayer === 1 ? "Black" : "White") : "-";
    statusColor.textContent = `Color: ${colorLabel}`;
    statusTurn.textContent = info.started
      ? `Turn: ${info.currentTurn} (${turnLabel})`
      : "Turn: -";

    const canStart = info.connected && info.readyPeer && !info.started;
    readyBtn.textContent = "Ready";
    readyBtn.dataset.ready = info.readySelf ? "true" : "false";
    readyBtn.classList.toggle("btn-primary", !info.readySelf);
    readyBtn.classList.toggle("btn-ghost", info.readySelf);
    readyBtn.style.display = !info.started && !canStart ? "inline-flex" : "none";
    readyBtn.disabled = !info.connected;
    startBtn.style.display = canStart ? "inline-flex" : "none";
    startBtn.disabled = !canStart;
    const undoPending = undoBtn.dataset.pending === "true";
    undoBtn.disabled = !info.connected || !info.started || undoPending;
    const restartPending = restartBtn.dataset.pending === "true";
    restartBtn.style.display = info.started ? "inline-flex" : "none";
    restartBtn.disabled = !info.connected || !info.started || restartPending;
    void updateQr();
  };

  panel.refs.signalUrl.addEventListener("input", () => {
    void updateQr();
  });

  panel.refs.configButton.addEventListener("click", () => {
    configInput.value = panel.refs.signalUrl.value;
    configModal.classList.remove("hidden");
    configInput.focus();
  });
  configCancel.addEventListener("click", () => {
    configModal.classList.add("hidden");
  });
  configSave.addEventListener("click", () => {
    const nextUrl = configInput.value.trim();
    panel.refs.signalUrl.value = nextUrl;
    configModal.classList.add("hidden");
    panel.refs.root.dispatchEvent(
      new CustomEvent("signalUrlChanged", { detail: { url: nextUrl } }),
    );
    void updateQr();
  });
  configModal.addEventListener("click", (event) => {
    if (event.target === configModal) {
      configModal.classList.add("hidden");
    }
  });

  panel.refs.gameSubtitle.addEventListener("click", async () => {
    const id = lastPeerId;
    if (!id) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
        console.log("[shell-ui] Game id copied.");
      }
    } catch {
      // ignore
    }
  });

  panel.refs.targetId.addEventListener("input", () => {
    const parsed = parseShareInput(panel.refs.targetId.value);
    if (parsed) {
      panel.refs.targetId.value = parsed.peerId;
      if (parsed.signalUrl) {
        panel.refs.signalUrl.value = parsed.signalUrl;
      }
      void updateQr();
    }
  });

  const shareLink = async (options: { peerId: string; signalUrl: string; title?: string }) => {
    const { peerId, signalUrl, title } = options;
    if (!peerId || peerId === "-") {
      console.log("[shell-ui] Register first to get a peer id.");
      return;
    }
    const shareUrl = buildShareUrl(peerId, signalUrl);
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        console.log("[shell-ui] Share link copied.");
        return;
      }
    } catch (err) {
      const error = err as { name?: string };
      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        window.prompt(title ?? "Copy link", shareUrl);
      } else {
        console.log("[shell-ui] Share link copy failed", err);
      }
      return;
    }
    window.prompt(title ?? "Copy link", shareUrl);
  };

  const log = (message: string) => {
    if (logPanel.classList.contains("hidden")) {
      return;
    }
    const entry = document.createElement("div");
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBody.prepend(entry);
  };

  if (window.location.hash.includes("debug=1")) {
    logPanel.classList.remove("hidden");
    (window as unknown as { __p2p_debug?: (msg: string) => void }).__p2p_debug = log;
  }

  return {
    elements: { container, boardWrap },
    panel,
    controls: {
      bindEvents: (events) => {
        readyBtn.addEventListener("click", async () => {
          const ready = readyBtn.dataset.ready === "true";
          readyBtn.disabled = true;
          try {
            await events.onReady(!ready);
          } finally {
            readyBtn.disabled = false;
          }
        });
        startBtn.addEventListener("click", async () => {
          startBtn.disabled = true;
          try {
            await events.onStart();
          } finally {
            startBtn.disabled = false;
          }
        });
        undoBtn.dataset.pending = "false";
        undoBtn.addEventListener("click", async () => {
          if (undoBtn.dataset.pending === "true") {
            return;
          }
          undoBtn.dataset.pending = "true";
          undoBtn.disabled = true;
          try {
            await events.onUndo();
          } finally {
            undoBtn.dataset.pending = "false";
          }
        });
        restartBtn.dataset.pending = "false";
        restartBtn.addEventListener("click", async () => {
          if (restartBtn.dataset.pending === "true") {
            return;
          }
          restartBtn.dataset.pending = "true";
          restartBtn.disabled = true;
          try {
            await events.onRestart();
          } finally {
            restartBtn.dataset.pending = "false";
          }
        });
      },
    },
    updatePanel,
    shareLink,
    getPeerId: () => lastPeerId,
    log,
    promptUndo: () => showRequest("Opponent requests an undo. Allow?"),
    promptRestart: () => showRequest("Opponent requests a restart. Allow?"),
    promptRejoinChoice: () =>
      showRequest("Resume previous match?", "Rejoin", "Restart").then((ok) =>
        ok ? "rejoin" : "restart",
      ),
    promptRejoinApprove: () => showRequest("Opponent requests a rejoin. Allow?"),
    showStart: () => {
      layout.startOverlay.classList.remove("play");
      void layout.startOverlay.offsetWidth;
      layout.startOverlay.classList.add("play");
    },
    showWinner: (winner) => showWinner(winner, lastMyColor),
    showNotice,
  };
};
