import QRCode from 'qrcode';
import type { PanelRefs } from '../../shell/ui/panel';
import type { ShellUiBundle } from '../../shell/ui/shellUi';
import { createDesktopStyles } from './styles';

const createPanelRefs = (): { refs: PanelRefs; bindEvents: (events: {
  onConnect: (peerId: string) => void;
  onShare: () => void;
}) => void } => {
  const root = document.createElement("div");
  root.className = "desktop-shell__sidebar";

  const header = document.createElement("div");
  header.className = "desktop-shell__header";
  const gameTitle = document.createElement("span");
  gameTitle.className = "desktop-shell__title";
  gameTitle.textContent = "-";
  const gameSubtitle = document.createElement("span");
  gameSubtitle.className = "desktop-shell__subtitle";
  gameSubtitle.textContent = "ID: -";
  header.append(gameTitle, gameSubtitle);

  const refreshButton = document.createElement("button");
  refreshButton.className = "desktop-shell__btn";
  refreshButton.textContent = "Register";
  header.append(refreshButton);

  const fieldSignal = document.createElement("div");
  fieldSignal.className = "desktop-shell__field";
  const signalLabel = document.createElement("label");
  signalLabel.textContent = "Signaling URL";
  const signalRow = document.createElement("div");
  signalRow.className = "desktop-shell__inputs";
  const signalUrl = document.createElement("input");
  signalUrl.placeholder = "ws://host:port";
  signalUrl.autocomplete = "off";
  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply";
  signalRow.append(signalUrl, applyBtn);
  fieldSignal.append(signalLabel, signalRow);

  const joinCard = document.createElement("div");
  joinCard.className = "desktop-shell__field";
  const targetLabel = document.createElement("label");
  targetLabel.textContent = "Target ID";
  const targetRow = document.createElement("div");
  targetRow.className = "desktop-shell__inputs";
  const targetId = document.createElement("input");
  targetId.placeholder = "peer id or share link";
  const joinButton = document.createElement("button");
  joinButton.textContent = "Connect";
  targetRow.append(targetId, joinButton);
  joinCard.append(targetLabel, targetRow);

  const shareCard = document.createElement("div");
  shareCard.className = "desktop-shell__share";
  const shareQr = document.createElement("canvas");
  shareQr.width = 220;
  shareQr.height = 220;
  const shareButton = document.createElement("button");
  shareButton.className = "desktop-shell__btn";
  shareButton.textContent = "Copy Share Link";
  shareCard.append(shareQr, shareButton);

  const configButton = document.createElement("button");
  configButton.style.display = "none";

  root.append(header, fieldSignal, joinCard, shareCard);

  const bindEvents = (events: { onConnect: (peerId: string) => void; onShare: () => void }) => {
    joinButton.addEventListener("click", () => events.onConnect(targetId.value));
    shareButton.addEventListener("click", () => events.onShare());
  };

  const refs: PanelRefs = {
    root,
    gameTitle,
    gameSubtitle,
    shareQr,
    signalUrl,
    targetId,
    joinButton,
    shareButton,
    configButton,
    refreshButton,
    joinCard,
    shareCard,
  };

  return { refs, bindEvents };
};

const createModal = () => {
  const overlay = document.createElement("div");
  overlay.className = "desktop-shell__modal hidden";
  const card = document.createElement("div");
  card.className = "desktop-shell__modal-card";
  const label = document.createElement("div");
  const actions = document.createElement("div");
  actions.className = "desktop-shell__modal-actions";
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "desktop-shell__btn";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "desktop-shell__btn";
  cancelBtn.style.background = "rgba(255,255,255,0.1)";
  cancelBtn.style.color = "#f6f7fb";
  actions.append(confirmBtn, cancelBtn);
  card.append(label, actions);
  overlay.append(card);
  document.body.appendChild(overlay);

  const ask = (message: string, okLabel = "OK", cancelLabel = "Cancel") =>
    new Promise<boolean>((resolve) => {
      label.textContent = message;
      confirmBtn.textContent = okLabel;
      cancelBtn.textContent = cancelLabel;
      overlay.classList.remove("hidden");
      const finish = (value: boolean) => {
        overlay.classList.add("hidden");
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onBackdrop);
        resolve(value);
      };
      const onConfirm = () => finish(true);
      const onCancel = () => finish(false);
      const onBackdrop = (event: MouseEvent) => {
        if (event.target === overlay) {
          finish(false);
        }
      };
      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", onBackdrop);
    });

  return { ask };
};

const buildShareUrl = (peerId: string, signalUrl: string) => {
  const url = new URL(window.location.href);
  const params = new URLSearchParams();
  params.set("id", peerId);
  params.set("url", signalUrl);
  url.hash = params.toString();
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

export const createDesktopShellUi = (options?: { defaultSignalUrl?: string }): ShellUiBundle => {
  createDesktopStyles();

  const { refs: panelRefs, bindEvents } = createPanelRefs();
  const container = document.createElement("div");
  container.className = "desktop-shell single";
  const boardWrap = document.createElement("div");
  boardWrap.className = "desktop-shell__board";
  const noticeBar = document.createElement("div");
  noticeBar.className = "desktop-shell__notice";

  const statusGrid = document.createElement("div");
  statusGrid.className = "desktop-shell__status";
  const colorLabel = document.createElement("div");
  colorLabel.innerHTML = `Color<br/><span>-</span>`;
  const turnLabel = document.createElement("div");
  turnLabel.innerHTML = `Turn<br/><span>-</span>`;
  const readyLabel = document.createElement("div");
  readyLabel.innerHTML = `Ready<br/><span>-</span>`;
  const cacheLabel = document.createElement("div");
  cacheLabel.innerHTML = `Cache<br/><span>-</span>`;
  statusGrid.append(colorLabel, turnLabel, readyLabel, cacheLabel);

  const controls = document.createElement("div");
  controls.className = "desktop-shell__controls";
  const readyBtn = document.createElement("button");
  readyBtn.className = "desktop-shell__btn secondary";
  readyBtn.textContent = "Ready";
  readyBtn.dataset.ready = "false";
  const startBtn = document.createElement("button");
  startBtn.className = "desktop-shell__btn primary";
  startBtn.textContent = "Start";
  const undoBtn = document.createElement("button");
  undoBtn.className = "desktop-shell__btn secondary";
  undoBtn.textContent = "Undo";
  undoBtn.dataset.pending = "false";
  const restartBtn = document.createElement("button");
  restartBtn.className = "desktop-shell__btn secondary";
  restartBtn.textContent = "Restart";
  restartBtn.dataset.pending = "false";
  controls.append(readyBtn, startBtn, undoBtn, restartBtn);

  const logPanel = document.createElement("div");
  logPanel.className = "desktop-shell__log hidden";
  const logBody = document.createElement("div");
  logBody.className = "desktop-shell__log-body";
  logPanel.append(logBody);

  panelRefs.root.append(statusGrid, controls, noticeBar, logPanel);
  container.append(panelRefs.root, boardWrap);

  if (options?.defaultSignalUrl) {
    panelRefs.signalUrl.value = options.defaultSignalUrl;
  }

  const modal = createModal();
  let lastPeerId = "";
  let lastMyColor: 1 | 2 | null = null;

  const updateQr = async () => {
    const peerId = lastPeerId;
    const signalUrl = panelRefs.signalUrl.value;
    const canvas = panelRefs.shareQr;
    const ctx = canvas.getContext("2d");
    if (!peerId || peerId === "-") {
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const shareUrl = buildShareUrl(peerId, signalUrl);
    try {
      const size = Math.max(200, Math.floor(canvas.getBoundingClientRect().width));
      await QRCode.toCanvas(canvas, shareUrl, { width: size, margin: 1 });
    } catch (err) {
      console.log("[desktop-shell] QR render failed", err);
    }
  };

  const updatePanel = (info: {
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
  }) => {
    lastPeerId = info.peerId || "";
    panelRefs.gameTitle.textContent = info.gameTitle || "-";
    panelRefs.gameSubtitle.textContent = `ID: ${info.peerId || "-"}`;
    container.classList.toggle("single", !info.connected);
    boardWrap.style.display = info.connected ? "block" : "none";
    panelRefs.joinCard.style.display = info.connected ? "none" : "flex";
    panelRefs.shareCard.style.display = info.connected ? "none" : "grid";

    lastMyColor = info.myColor;
    const colorText = info.started
      ? info.myColor === 1
        ? "Black"
        : info.myColor === 2
          ? "White"
          : "-"
      : "-";
    colorLabel.innerHTML = `Color<br/><span>${colorText}</span>`;
    const turnText = info.started ? `${info.currentTurn} (${info.currentPlayer === 1 ? "Black" : "White"})` : "-";
    turnLabel.innerHTML = `Turn<br/><span>${turnText}</span>`;
    const readyText = `${info.readySelf ? "You" : "You: wait"} / ${info.readyPeer ? "Peer" : "Peer: wait"}`;
    readyLabel.innerHTML = `Ready<br/><span>${readyText}</span>`;
    cacheLabel.innerHTML = `Cache<br/><span>${info.hasCache ? "Yes" : "No"}</span>`;

    const canStart = info.connected && info.readyPeer && !info.started;
    readyBtn.dataset.ready = info.readySelf ? "true" : "false";
    readyBtn.textContent = info.readySelf ? "Cancel Ready" : "Ready";
    readyBtn.disabled = !info.connected;
    readyBtn.style.display = !info.started && !canStart ? "inline-flex" : "none";
    startBtn.disabled = !canStart;
    startBtn.style.display = canStart ? "inline-flex" : "none";
    const undoPending = undoBtn.dataset.pending === "true";
    undoBtn.disabled = !info.connected || !info.started || undoPending;
    const restartPending = restartBtn.dataset.pending === "true";
    restartBtn.style.display = info.started ? "inline-flex" : "none";
    restartBtn.disabled = !info.connected || !info.started || restartPending;
    void updateQr();
  };

  panelRefs.gameSubtitle.addEventListener("click", async () => {
    if (!lastPeerId) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lastPeerId);
      }
    } catch {
      // ignore
    }
  });

  panelRefs.signalUrl.addEventListener("change", () => {
    panelRefs.root.dispatchEvent(
      new CustomEvent("signalUrlChanged", {
        detail: { url: panelRefs.signalUrl.value },
      }),
    );
    void updateQr();
  });

  panelRefs.targetId.addEventListener("input", () => {
    const parsed = parseShareInput(panelRefs.targetId.value);
    if (parsed) {
      panelRefs.targetId.value = parsed.peerId;
      if (parsed.signalUrl) {
        panelRefs.signalUrl.value = parsed.signalUrl;
        panelRefs.root.dispatchEvent(
          new CustomEvent("signalUrlChanged", { detail: { url: parsed.signalUrl } }),
        );
      }
      void updateQr();
    }
  });

  panelRefs.refreshButton.addEventListener("click", () => {
    panelRefs.root.dispatchEvent(
      new CustomEvent("signalUrlChanged", {
        detail: { url: panelRefs.signalUrl.value },
      }),
    );
  });

  const shareLink = async (options: { peerId: string; signalUrl: string; title?: string }) => {
    const { peerId, signalUrl, title } = options;
    if (!peerId || peerId === "-") {
      console.log("[desktop-shell] Register first to get a peer id.");
      return;
    }
    const shareUrl = buildShareUrl(peerId, signalUrl);
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        noticeBar.textContent = "Share link copied";
        return;
      }
    } catch (err) {
      const error = err as { name?: string };
      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        window.prompt(title ?? "Copy link", shareUrl);
      } else {
        console.log("[desktop-shell] Share link copy failed", err);
      }
      return;
    }
    window.prompt(title ?? "Copy link", shareUrl);
  };

  const log = (message: string) => {
    const entry = document.createElement("div");
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBody.prepend(entry);
    if (logPanel.classList.contains("hidden")) {
      logPanel.classList.remove("hidden");
    }
  };

  const showNotice = (message: string) => {
    noticeBar.textContent = message;
  };

  return {
    elements: { container, boardWrap },
    panel: {
      refs: panelRefs,
      bindEvents,
    },
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
    promptUndo: () => modal.ask("Opponent requests an undo. Allow?"),
    promptRestart: () => modal.ask("Opponent requests a restart. Allow?"),
    promptRejoinChoice: () =>
      modal.ask("Resume previous match?", "Rejoin", "Restart").then((ok) => (ok ? "rejoin" : "restart")),
    promptRejoinApprove: () => modal.ask("Opponent requests a rejoin. Allow?"),
    showStart: () => {
      noticeBar.textContent = "Match started";
    },
    showWinner: (winner) => {
      if (winner === 0) {
        noticeBar.textContent = "Draw";
        return;
      }
      noticeBar.textContent = winner === lastMyColor ? 'You win' : 'You lose';
    },
    showNotice,
  };
};
