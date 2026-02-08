type PanelEvents = {
  onConnect: (peerId: string) => void;
  onShare: () => void;
};

export type PanelRefs = {
  root: HTMLDivElement;
  peerId: HTMLSpanElement;
  status: HTMLSpanElement;
  gameTitle: HTMLSpanElement;
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
      <input id="signalUrl" type="text" value="" />
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
      <label>Game</label>
      <span id="gameTitle">-</span>
    </div>
    <div class="panel-row">
      <label>Status</label>
      <span id="status">idle</span>
    </div>
  `;

  root.append(connectSection, statusSection);

  const refs: PanelRefs = {
    root,
    peerId: root.querySelector("#myPeerId") as HTMLSpanElement,
    status: root.querySelector("#status") as HTMLSpanElement,
    gameTitle: root.querySelector("#gameTitle") as HTMLSpanElement,
    signalUrl: root.querySelector("#signalUrl") as HTMLInputElement,
    targetId: root.querySelector("#targetId") as HTMLInputElement,
  };

  const bindEvents = (events: PanelEvents) => {
    const connectBtn = root.querySelector("#connectBtn") as HTMLButtonElement;
    const shareBtn = root.querySelector("#shareBtn") as HTMLButtonElement;
    const { targetId } = refs;
    connectBtn.addEventListener("click", () => events.onConnect(targetId.value));
    shareBtn.addEventListener("click", () => events.onShare());
  };

  return { refs, bindEvents };
};
