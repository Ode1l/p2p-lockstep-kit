type PanelEvents = {
  onConnect: (peerId: string) => void;
  onShare: () => void;
};

export type PanelRefs = {
  root: HTMLDivElement;
  gameTitle: HTMLSpanElement;
  gameSubtitle: HTMLSpanElement;
  shareQr: HTMLCanvasElement;
  signalUrl: HTMLInputElement;
  targetId: HTMLInputElement;
  joinButton: HTMLButtonElement;
  shareButton: HTMLButtonElement;
  configButton: HTMLButtonElement;
  refreshButton: HTMLButtonElement;
  joinCard: HTMLDivElement;
  shareCard: HTMLDivElement;
};

export const createPanel = () => {
  const root = document.createElement("div");
  root.className = "panel";

  root.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <span class="game-label">Game</span>
        <span id="gameTitle" class="game-title">-</span>
        <span id="gameSubtitle" class="game-subtitle">ID: -</span>
      </div>
      <div class="panel-actions">
        <button id="refreshBtn" class="icon-btn" aria-label="Refresh">
          <svg class="icon icon-refresh" viewBox="0 0 16 16" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
          </svg>
        </button>
        <button id="configBtn" class="icon-btn" aria-label="Settings">
          <span class="icon-dots" aria-hidden="true">···</span>
        </button>
      </div>
    </div>

    <div class="panel-grid">
      <div class="panel-card card-primary" id="shareCard">
        <canvas id="shareQr" width="180" height="180"></canvas>
        <button id="shareBtn" class="btn btn-ghost">Copy Share Link</button>
      </div>

      <div class="panel-card card-join" id="joinCard">
        <input id="targetId" type="text" placeholder="peer id or share link" />
        <button id="connectBtn" class="btn btn-primary">Join</button>
      </div>

    </div>

    <div class="panel-advanced">
      <span class="advanced-label">Signaling URL</span>
      <input id="signalUrl" type="text" value="" />
    </div>
  `;

  const refs: PanelRefs = {
    root,
    gameTitle: root.querySelector("#gameTitle") as HTMLSpanElement,
    gameSubtitle: root.querySelector("#gameSubtitle") as HTMLSpanElement,
    shareQr: root.querySelector("#shareQr") as HTMLCanvasElement,
    signalUrl: root.querySelector("#signalUrl") as HTMLInputElement,
    targetId: root.querySelector("#targetId") as HTMLInputElement,
    joinButton: root.querySelector("#connectBtn") as HTMLButtonElement,
    shareButton: root.querySelector("#shareBtn") as HTMLButtonElement,
    configButton: root.querySelector("#configBtn") as HTMLButtonElement,
    refreshButton: root.querySelector("#refreshBtn") as HTMLButtonElement,
    joinCard: root.querySelector("#joinCard") as HTMLDivElement,
    shareCard: root.querySelector("#shareCard") as HTMLDivElement,
  };

  const bindEvents = (events: PanelEvents) => {
    const { targetId } = refs;
    refs.joinButton.addEventListener("click", () => events.onConnect(targetId.value));
    refs.shareButton.addEventListener("click", () => events.onShare());
  };

  return { refs, bindEvents };
};
