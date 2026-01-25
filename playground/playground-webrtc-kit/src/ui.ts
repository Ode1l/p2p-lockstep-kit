import type { PeerLabel, PeerState } from "./types";

export type UIRefs = {
  createPairButton: HTMLButtonElement;
  resetPairButton: HTMLButtonElement;
  sendAButton: HTMLButtonElement;
  sendBButton: HTMLButtonElement;
  inputA: HTMLInputElement;
  inputB: HTMLInputElement;
  logA: HTMLPreElement;
  logB: HTMLPreElement;
  pcAText: HTMLSpanElement;
  pcBText: HTMLSpanElement;
  dcAText: HTMLSpanElement;
  dcBText: HTMLSpanElement;
};

export const renderApp = (app: HTMLDivElement) => {
  app.innerHTML = `
    <div class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">Kit Demo</p>
          <h1>WebRTC Transport Playground</h1>
          <p class="sub">Loopback demo that uses the kit transport wrapper.</p>
        </div>
        <div class="actions">
          <button id="createPair" class="primary">Connect</button>
          <button id="resetPair" class="ghost">Reset</button>
        </div>
      </header>

      <section class="grid">
        <article class="card" id="peerA">
          <div class="card-header">
            <h2>Peer A</h2>
            <div class="status"><span id="pcAText">RTCPeerConnection: idle</span></div>
            <div class="status"><span id="dcAText">DataChannel: idle</span></div>
          </div>
          <div class="controls">
            <input id="inputA" type="text" placeholder="Type message from A..." />
            <button id="sendA" class="primary" disabled>Send</button>
          </div>
          <pre id="logA" class="log"></pre>
        </article>

        <article class="card" id="peerB">
          <div class="card-header">
            <h2>Peer B</h2>
            <div class="status"><span id="pcBText">RTCPeerConnection: idle</span></div>
            <div class="status"><span id="dcBText">DataChannel: idle</span></div>
          </div>
          <div class="controls">
            <input id="inputB" type="text" placeholder="Type message from B..." />
            <button id="sendB" class="primary" disabled>Send</button>
          </div>
          <pre id="logB" class="log"></pre>
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
    }

    .hero {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      margin-bottom: 28px;
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
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
    }

    .log {
      background: #111;
      color: #eaeaea;
      border-radius: 12px;
      padding: 12px;
      min-height: 140px;
      max-height: 220px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
    }

    @media (max-width: 720px) {
      .hero { flex-direction: column; align-items: flex-start; }
      .actions { width: 100%; }
      .actions button { flex: 1; }
      .controls { flex-direction: column; }
    }
  `;
  document.head.appendChild(style);
};

export const getUIRefs = (): UIRefs => ({
  createPairButton: document.querySelector<HTMLButtonElement>("#createPair")!,
  resetPairButton: document.querySelector<HTMLButtonElement>("#resetPair")!,
  sendAButton: document.querySelector<HTMLButtonElement>("#sendA")!,
  sendBButton: document.querySelector<HTMLButtonElement>("#sendB")!,
  inputA: document.querySelector<HTMLInputElement>("#inputA")!,
  inputB: document.querySelector<HTMLInputElement>("#inputB")!,
  logA: document.querySelector<HTMLPreElement>("#logA")!,
  logB: document.querySelector<HTMLPreElement>("#logB")!,
  pcAText: document.querySelector<HTMLSpanElement>("#pcAText")!,
  pcBText: document.querySelector<HTMLSpanElement>("#pcBText")!,
  dcAText: document.querySelector<HTMLSpanElement>("#dcAText")!,
  dcBText: document.querySelector<HTMLSpanElement>("#dcBText")!,
});

export const resetLogs = (ui: UIRefs) => {
  ui.logA.textContent = "";
  ui.logB.textContent = "";
};

export const log = (ui: UIRefs, peer: PeerLabel, message: string) => {
  const target = peer === "A" ? ui.logA : ui.logB;
  const timestamp = new Date().toLocaleTimeString();
  target.textContent += `[${timestamp}] ${message}\n`;
  target.scrollTop = target.scrollHeight;
};

export const updatePcStatus = (
  ui: UIRefs,
  peer: PeerLabel,
  state: RTCPeerConnectionState | "idle",
) => {
  const text = `RTCPeerConnection: ${state}`;
  if (peer === "A") {
    ui.pcAText.textContent = text;
    return;
  }
  ui.pcBText.textContent = text;
};

export const updateDcStatus = (
  ui: UIRefs,
  peer: PeerLabel,
  state: RTCDataChannelState | "idle",
  peerState: PeerState,
) => {
  const text = `DataChannel: ${state}`;
  if (peer === "A") {
    ui.dcAText.textContent = text;
  } else {
    ui.dcBText.textContent = text;
  }

  const isOpenA = peerState.dcA?.readyState === "open";
  const isOpenB = peerState.dcB?.readyState === "open";
  ui.sendAButton.disabled = !isOpenA;
  ui.sendBButton.disabled = !isOpenB;
};