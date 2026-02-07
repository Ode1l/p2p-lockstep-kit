type PanelEvents = {
  onConnect: (peerId: string) => void;
  onShare: () => void;
  onReady: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onDisconnect: () => void;
};

export type PanelRefs = {
  root: HTMLDivElement;
  peerId: HTMLSpanElement;
  status: HTMLSpanElement;
  color: HTMLSpanElement;
  turn: HTMLSpanElement;
  hash: HTMLSpanElement;
  log: HTMLDivElement;
  readyButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  signalUrl: HTMLInputElement;
  targetId: HTMLInputElement;
};

export const createPanel = () => {
  const root = document.createElement("div");
  root.className = "panel";

  const connectSection = document.createElement("div");
  connectSection.className = "panel-section";
  connectSection.innerHTML = `
    <div class="panel-row">
      <label>Signaling URL</label>
      <input id="signalUrl" type="text" value="ws://192.168.0.102:8787" />
    </div>
    <div class="panel-row">
      <label>My Peer ID</label>
      <span id="myPeerId">-</span>
    </div>
    <div class="panel-row">
      <label>Target Peer ID</label>
      <input id="targetId" type="text" placeholder="peer id" />
      <button id="connectBtn">Join</button>
    </div>
    <div class="panel-row">
      <label>Share Link</label>
      <button id="shareBtn">Share</button>
    </div>
  `;

  const statusSection = document.createElement("div");
  statusSection.className = "panel-section";
  statusSection.innerHTML = `
    <div class="panel-row">
      <label>Status</label>
      <span id="status">idle</span>
    </div>
    <div class="panel-row">
      <label>Color</label>
      <span id="color">-</span>
    </div>
    <div class="panel-row">
      <label>Turn</label>
      <span id="turn">-</span>
    </div>
    <div class="panel-row">
      <label>Hash</label>
      <span id="hash">-</span>
    </div>
  `;

  const actionSection = document.createElement("div");
  actionSection.className = "panel-section actions";
  actionSection.innerHTML = `
    <button id="readyBtn">Ready</button>
    <button id="undoBtn">Undo</button>
    <button id="restartBtn">Restart</button>
    <button id="disconnectBtn">Disconnect</button>
  `;

  const logSection = document.createElement("div");
  logSection.className = "panel-section log";
  logSection.innerHTML = `<div class="log-title">Log</div><div id="logBody"></div>`;

  root.append(connectSection, statusSection, actionSection, logSection);

  const refs: PanelRefs = {
    root,
    peerId: root.querySelector("#myPeerId") as HTMLSpanElement,
    status: root.querySelector("#status") as HTMLSpanElement,
    color: root.querySelector("#color") as HTMLSpanElement,
    turn: root.querySelector("#turn") as HTMLSpanElement,
    hash: root.querySelector("#hash") as HTMLSpanElement,
    log: root.querySelector("#logBody") as HTMLDivElement,
    readyButton: root.querySelector("#readyBtn") as HTMLButtonElement,
    undoButton: root.querySelector("#undoBtn") as HTMLButtonElement,
    restartButton: root.querySelector("#restartBtn") as HTMLButtonElement,
    signalUrl: root.querySelector("#signalUrl") as HTMLInputElement,
    targetId: root.querySelector("#targetId") as HTMLInputElement,
  };

  const bindEvents = (events: PanelEvents) => {
    const connectBtn = root.querySelector("#connectBtn") as HTMLButtonElement;
    const shareBtn = root.querySelector("#shareBtn") as HTMLButtonElement;
    const disconnectBtn = root.querySelector("#disconnectBtn") as HTMLButtonElement;
    const { targetId } = refs;
    connectBtn.addEventListener("click", () => events.onConnect(targetId.value));
    shareBtn.addEventListener("click", () => events.onShare());
    disconnectBtn.addEventListener("click", () => events.onDisconnect());
    refs.readyButton.addEventListener("click", () => events.onReady());
    refs.undoButton.addEventListener("click", () => events.onUndo());
    refs.restartButton.addEventListener("click", () => events.onRestart());
  };

  return { refs, bindEvents };
};
