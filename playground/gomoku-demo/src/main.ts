import { BoardView } from "./ui/board";
import { createPanel } from "./ui/panel";
import { createNetClient } from "./net/client";
import { createController } from "./app/controller";

const createStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: #f3efe8;
      color: #2a2621;
    }
    body { margin: 0; padding: 24px; }
    .app {
      display: grid;
      grid-template-columns: minmax(320px, 380px) minmax(480px, 1fr);
      gap: 24px;
      align-items: start;
    }
    .panel {
      background: #fff8ec;
      border: 1px solid #d7c9b2;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 12px 30px rgba(25, 20, 15, 0.08);
    }
    .panel-section { margin-bottom: 16px; }
    .panel-row {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .panel-row label { font-weight: 600; }
    .panel input {
      border: 1px solid #cbbba3;
      background: #fffdf8;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 13px;
      min-width: 0;
    }
    .panel button {
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      background: #3f352c;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      margin-right: 4px;
      justify-self: start;
    }
    .panel button:focus-visible {
      outline: 2px solid #2a2621;
      outline-offset: 2px;
    }
    .panel button:focus {
      outline: none;
    }
    .panel button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .log { max-height: 200px; overflow: auto; }
    .log-title { font-weight: 600; margin-bottom: 8px; }
    .log-entry { font-size: 12px; margin-bottom: 6px; }
    .board-wrapper {
      background: linear-gradient(135deg, #f0d6a3, #e4c58d);
      padding: 16px;
      border-radius: 20px;
      box-shadow: inset 0 0 0 2px rgba(90, 70, 40, 0.2);
      display: inline-block;
      justify-self: start;
      width: fit-content;
      max-width: 100%;
      position: relative;
    }
    .board-wrapper canvas {
      display: block;
      width: 100%;
      height: auto;
      touch-action: none;
    }
    .board-placeholder {
      display: none;
    }
    .board-offline {
      display: none;
    }
    .mobile-actions {
      display: none;
      gap: 8px;
      margin-top: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .mobile-actions button {
      border: none;
      padding: 10px 16px;
      border-radius: 10px;
      background: #3f352c;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    }
    .mobile-actions button:focus-visible {
      outline: 2px solid #2a2621;
      outline-offset: 2px;
    }
    .mobile-actions button:focus {
      outline: none;
    }
    .result-modal {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(20, 18, 12, 0.6);
      z-index: 999;
    }
    .result-modal.hidden {
      display: none;
    }
    .result-card {
      background: #fff8ec;
      border: 1px solid #d7c9b2;
      border-radius: 16px;
      padding: 24px 28px;
      text-align: center;
      min-width: 240px;
      box-shadow: 0 18px 40px rgba(15, 12, 8, 0.25);
      font-size: 18px;
      font-weight: 600;
    }
    .result-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .result-sub {
      font-size: 12px;
      margin-top: 8px;
      font-weight: 500;
      color: #5a4b3b;
    }
    .modal-actions {
      margin-top: 16px;
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .modal-btn {
      border: 1px solid #cbbba3;
      background: #fffdf8;
      color: #3f352c;
      padding: 8px 14px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .modal-btn.primary {
      background: #3f352c;
      color: #fff;
      border-color: #3f352c;
    }
    @media (max-width: 900px) {
      .app { grid-template-columns: 1fr; }
      .panel-row { grid-template-columns: 1fr; }
      .panel-row button { width: 100%; }
      .mobile-actions { display: flex; }
      .panel.panel-hidden { display: none; }
    }
  `;
  document.head.append(style);
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app");
}

createStyles();

const boardView = new BoardView(520);
const panel = createPanel();

const container = document.createElement("div");
container.className = "app";
const boardWrap = document.createElement("div");
boardWrap.className = "board-wrapper";
boardWrap.append(boardView.element);
container.append(panel.refs.root, boardWrap);
app.append(container);

const net = createNetClient();

type ModalAction = { id: string; label: string; primary?: boolean };

const modal = document.createElement("div");
modal.className = "result-modal hidden";
modal.innerHTML = `
  <div class="result-card">
    <div class="result-title" id="modalTitle">Notice</div>
    <div class="result-sub" id="modalMessage"></div>
    <div class="modal-actions" id="modalActions"></div>
  </div>
`;
document.body.append(modal);

const showModal = (title: string, message: string, actions: ModalAction[]) =>
  new Promise<string>((resolve) => {
    const titleEl = modal.querySelector("#modalTitle") as HTMLDivElement;
    const msgEl = modal.querySelector("#modalMessage") as HTMLDivElement;
    const actionsEl = modal.querySelector("#modalActions") as HTMLDivElement;
    titleEl.textContent = title;
    msgEl.textContent = message;
    actionsEl.innerHTML = "";
    for (const action of actions) {
      const btn = document.createElement("button");
      btn.textContent = action.label;
      btn.className = action.primary ? "modal-btn primary" : "modal-btn";
      btn.addEventListener("click", () => {
        modal.classList.add("hidden");
        resolve(action.id);
      });
      actionsEl.append(btn);
    }
    modal.classList.remove("hidden");
  });

const hideModal = () => {
  modal.classList.add("hidden");
};

const log = (message: string) => {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  panel.refs.log.prepend(entry);
};

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const urlParam = hashParams.get("url");
const idParam = hashParams.get("id");
if (urlParam) {
  panel.refs.signalUrl.value = urlParam;
}
if (idParam) {
  panel.refs.targetId.value = idParam;
}

let lastPanelInfo: {
  readyMe: boolean;
  readyPeer: boolean;
} = { readyMe: false, readyPeer: false };

let mobileReady: HTMLButtonElement | null = null;
let mobileUndo: HTMLButtonElement | null = null;
let mobileRestart: HTMLButtonElement | null = null;
let mobileActions: HTMLDivElement | null = null;

const controller = createController(net, {
  renderBoard: (state, hover, ghost) => {
    boardView.render(state.board, hover, ghost);
  },
  updatePanel: (info) => {
    lastPanelInfo = { readyMe: info.readyMe, readyPeer: info.readyPeer };
    panel.refs.peerId.textContent = info.peerId || "-";
    panel.refs.status.textContent = info.connected ? "connected" : "idle";
    panel.refs.color.textContent =
      info.myColor === 1 ? "Black" : info.myColor === 2 ? "White" : "-";
    panel.refs.turn.textContent = info.turnLabel;
    panel.refs.hash.textContent = info.hash;
    panel.refs.readyButton.disabled = !info.canReady;
    panel.refs.undoButton.disabled = !info.canUndo;
    panel.refs.restartButton.disabled = !info.canRestart;
    panel.refs.root.classList.toggle("panel-hidden", info.connected);
    boardWrap.classList.toggle("board-offline", !info.connected);
    if (mobileReady && mobileUndo && mobileRestart) {
      mobileReady.textContent = info.readyPeer ? "Start" : info.readyMe ? "Ready ✓" : "Ready";
      mobileReady.style.display = info.gameStarted ? "none" : "inline-block";
      mobileReady.disabled = !info.canReady;
      mobileUndo.disabled = !info.canUndo;
      mobileRestart.disabled = !info.canRestart;
    }
    if (mobileActions) {
      mobileActions.style.display = info.connected ? "flex" : "none";
    }
    if (info.readyMe) {
      panel.refs.readyButton.textContent = "Ready ✓";
    } else if (info.readyPeer) {
      panel.refs.readyButton.textContent = "Start";
    } else {
      panel.refs.readyButton.textContent = "Ready";
    }
  },
  log,
  confirmUndo: async () => {
    const result = await showModal("Undo", "Peer requests undo. Accept?", [
      { id: "accept", label: "Accept", primary: true },
      { id: "reject", label: "Reject" },
    ]);
    return result === "accept";
  },
  showResult: async (message) => {
    const label = lastPanelInfo.readyPeer && !lastPanelInfo.readyMe ? "Start" : "Ready";
    const action = await showModal("Game Over", message, [
      { id: "ready", label, primary: true },
    ]);
    if (action === "ready") {
      controller.onReady();
    }
  },
  hideResult: () => hideModal(),
  showRestoreChoice: async () => {
    const result = await showModal("Reconnect", "Restore last game or restart?", [
      { id: "restore", label: "Restore", primary: true },
      { id: "restart", label: "Restart" },
      { id: "cancel", label: "Cancel" },
    ]);
    if (result === "restore") {
      return "restore";
    }
    if (result === "restart") {
      return "restart";
    }
    return "cancel";
  },
  showRestartRequest: async () => {
    const result = await showModal("Restart", "Peer requests restart. Accept?", [
      { id: "accept", label: "Accept", primary: true },
      { id: "reject", label: "Reject" },
    ]);
    return result === "accept";
  },
});

panel.bindEvents({
  onConnect: controller.onConnect,
  onShare: async () => {
    const peerId = panel.refs.peerId.textContent || "";
    if (!peerId || peerId === "-") {
      log("Register first to get a peer id.");
      return;
    }
    const url = new URL(window.location.href);
    const shareParams = new URLSearchParams();
    shareParams.set("id", peerId);
    shareParams.set("url", panel.refs.signalUrl.value);
    url.hash = shareParams.toString();
    const shareUrl = url.toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Gomoku", url: shareUrl });
        log("Share sheet opened.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        log("Share link copied.");
        return;
      }
    } catch {
      // fall through to manual copy
    }
    await showModal("Share Link", shareUrl, [{ id: "ok", label: "OK", primary: true }]);
    log("Copy the link manually from the dialog.");
  },
  onReady: controller.onReady,
  onUndo: controller.onUndo,
  onRestart: controller.onRestart,
  onDisconnect: controller.onDisconnect,
});

boardView.onHover((cell) => controller.onBoardHover(cell));
boardView.onClick((cell) => controller.onBoardClick(cell));

mobileActions = document.createElement("div");
mobileActions.className = "mobile-actions";
mobileActions.innerHTML = `
  <button id="mobileReady">Ready</button>
  <button id="mobileUndo">Undo</button>
  <button id="mobileRestart">Restart</button>
`;
boardWrap.append(mobileActions);
mobileReady = mobileActions.querySelector("#mobileReady") as HTMLButtonElement;
mobileUndo = mobileActions.querySelector("#mobileUndo") as HTMLButtonElement;
mobileRestart = mobileActions.querySelector("#mobileRestart") as HTMLButtonElement;
mobileReady.addEventListener("click", () => controller.onReady());
mobileUndo.addEventListener("click", () => controller.onUndo());
mobileRestart.addEventListener("click", () => controller.onRestart());

controller.start({
  autoRegisterUrl: panel.refs.signalUrl.value,
  autoConnectId: idParam ?? undefined,
});
