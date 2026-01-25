import type { PeerState } from "./types";

export type UIRefs = {
  signalingUrlInput: HTMLInputElement;
  peerIdInput: HTMLInputElement;
  targetIdInput: HTMLInputElement;
  connectSignalButton: HTMLButtonElement;
  connectPeerButton: HTMLButtonElement;
  resetPeerButton: HTMLButtonElement;
  signalStateText: HTMLSpanElement;
  peersText: HTMLSpanElement;
  sendButton: HTMLButtonElement;
  input: HTMLInputElement;
  log: HTMLPreElement;
  pcText: HTMLSpanElement;
  dcText: HTMLSpanElement;
};

export const renderApp = (app: HTMLDivElement) => {
  app.innerHTML = `
    <div class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">Kit Demo</p>
          <h1>WebRTC + Signaling Playground</h1>
          <p class="sub">Open two tabs, set different peerIds, and connect via signaling.</p>
        </div>
        <div class="actions">
          <button id="connectPeer" class="primary">Connect P2P</button>
          <button id="resetPeer" class="ghost">Reset</button>
        </div>
      </header>

      <section class="panel">
        <div class="row">
          <label class="field">
            <span>Signaling URL</span>
            <input id="signalingUrl" type="text" value="ws://localhost:8787" />
          </label>
          <label class="field">
            <span>Peer ID (me)</span>
            <input id="peerId" type="text" placeholder="peer-a" />
          </label>
          <label class="field">
            <span>Target Peer ID</span>
            <input id="targetId" type="text" placeholder="peer-b" />
          </label>
          <div class="field actions-inline">
            <span>Signaling</span>
            <button id="connectSignal" class="ghost">Connect WS</button>
          </div>
        </div>
        <div class="meta">
          <span id="signalState">Signaling: idle</span>
          <span id="peers">Peers: -</span>
        </div>
      </section>

      <section class="grid">
        <article class="card">
          <div class="card-header">
            <h2>Local Peer</h2>
            <div class="status"><span id="pcText">RTCPeerConnection: idle</span></div>
            <div class="status"><span id="dcText">DataChannel: idle</span></div>
          </div>
          <div class="controls">
            <input id="input" type="text" placeholder="Type message..." />
            <button id="send" class="primary" disabled>Send</button>
          </div>
          <pre id="log" class="log"></pre>
        </article>
      </section>
    </div>
  `;
};

export const injectStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --bg: #f7f4ee;
      --panel: #ffffff;
      --ink: #1f1a14;
      --muted: #6f6256;
      --accent: #e4572e;
      --accent-2: #1f9d78;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 10% 10%, rgba(228, 87, 46, 0.12), transparent 50%),
        radial-gradient(circle at 90% 0%, rgba(31, 157, 120, 0.12), transparent 45%),
        var(--bg);
    }

    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 48px 24px 64px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .hero {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      margin-bottom: 8px;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.2em;
      font-size: 12px;
      color: var(--muted);
      margin: 0 0 8px;
    }

    h1 {
      font-size: clamp(28px, 4vw, 44px);
      margin: 0 0 6px;
    }

    .sub { margin: 0; color: var(--muted); }

    .actions { display: flex; gap: 10px; }

    .panel {
      background: var(--panel);
      border-radius: 16px;
      padding: 14px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
    }

    .actions-inline {
      justify-content: flex-end;
    }

    .meta {
      display: flex;
      gap: 14px;
      font-size: 12px;
      color: var(--muted);
    }

    button {
      border: 0;
      padding: 10px 18px;
      border-radius: 999px;
      font-weight: 600;
      cursor: pointer;
    }

    button.primary {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 10px 22px rgba(228, 87, 46, 0.25);
    }

    button.ghost {
      background: rgba(0, 0, 0, 0.06);
      color: var(--ink);
    }

    button:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: minmax(0, 1fr);
    }

    .card {
      background: var(--panel);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card-header h2 { margin: 0 0 8px; }
    .status { font-size: 13px; color: var(--muted); }

    .controls { display: flex; gap: 10px; }

    input {
      flex: 1;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      font-size: 14px;
      background: #fff;
      color: var(--ink);
    }

    .log {
      background: #111;
      color: #eaeaea;
      border-radius: 12px;
      padding: 12px;
      min-height: 160px;
      max-height: 280px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
    }

    @media (max-width: 960px) {
      .row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 720px) {
      .hero { flex-direction: column; align-items: flex-start; }
      .actions { width: 100%; }
      .actions button { flex: 1; }
      .row { grid-template-columns: minmax(0, 1fr); }
      .controls { flex-direction: column; }
    }
  `;
  document.head.appendChild(style);
};

export const getUIRefs = (): UIRefs => ({
  signalingUrlInput: document.querySelector<HTMLInputElement>("#signalingUrl")!,
  peerIdInput: document.querySelector<HTMLInputElement>("#peerId")!,
  targetIdInput: document.querySelector<HTMLInputElement>("#targetId")!,
  connectSignalButton: document.querySelector<HTMLButtonElement>("#connectSignal")!,
  connectPeerButton: document.querySelector<HTMLButtonElement>("#connectPeer")!,
  resetPeerButton: document.querySelector<HTMLButtonElement>("#resetPeer")!,
  signalStateText: document.querySelector<HTMLSpanElement>("#signalState")!,
  peersText: document.querySelector<HTMLSpanElement>("#peers")!,
  sendButton: document.querySelector<HTMLButtonElement>("#send")!,
  input: document.querySelector<HTMLInputElement>("#input")!,
  log: document.querySelector<HTMLPreElement>("#log")!,
  pcText: document.querySelector<HTMLSpanElement>("#pcText")!,
  dcText: document.querySelector<HTMLSpanElement>("#dcText")!,
});

export const resetLogs = (ui: UIRefs) => {
  ui.log.textContent = "";
};

export const log = (ui: UIRefs, message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  ui.log.textContent += `[${timestamp}] ${message}\n`;
  ui.log.scrollTop = ui.log.scrollHeight;
};

export const updateSignalState = (ui: UIRefs, state: string) => {
  ui.signalStateText.textContent = `Signaling: ${state}`;
};

export const updatePeers = (ui: UIRefs, peers: string[]) => {
  ui.peersText.textContent = `Peers: ${peers.length ? peers.join(",") : "-"}`;
};

export const updatePcStatus = (ui: UIRefs, state: RTCPeerConnectionState | "idle") => {
  ui.pcText.textContent = `RTCPeerConnection: ${state}`;
};

export const updateDcStatus = (
  ui: UIRefs,
  state: RTCDataChannelState | "idle",
  peerState: PeerState,
) => {
  ui.dcText.textContent = `DataChannel: ${state}`;
  const isOpen = peerState.transport?.state === "open";
  ui.sendButton.disabled = !isOpen;
};