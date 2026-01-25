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
  pcAStateDot: HTMLSpanElement;
  pcBStateDot: HTMLSpanElement;
  dcAStateDot: HTMLSpanElement;
  dcBStateDot: HTMLSpanElement;
};

export const renderApp = (app: HTMLDivElement) => {
  app.innerHTML = `
    <div class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">Milestone 0</p>
          <h1>P2P DataChannel Playground</h1>
          <p class="sub">Single-page, two-peer WebRTC loopback. Create a pair and exchange strings.</p>
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
            <div class="status">
              <span class="dot" id="pcAState"></span>
              <span id="pcAText">RTCPeerConnection: idle</span>
            </div>
            <div class="status">
              <span class="dot" id="dcAState"></span>
              <span id="dcAText">DataChannel: idle</span>
            </div>
          </div>
          <div class="controls">
            <input id="inputA" type="text" placeholder="Type message from A..." />
            <button id="sendA" class="primary" disabled>Send A to B</button>
          </div>
          <pre id="logA" class="log"></pre>
        </article>

        <article class="card" id="peerB">
          <div class="card-header">
            <h2>Peer B</h2>
            <div class="status">
              <span class="dot" id="pcBState"></span>
              <span id="pcBText">RTCPeerConnection: idle</span>
            </div>
            <div class="status">
              <span class="dot" id="dcBState"></span>
              <span id="dcBText">DataChannel: idle</span>
            </div>
          </div>
          <div class="controls">
            <input id="inputB" type="text" placeholder="Type message from B..." />
            <button id="sendB" class="primary" disabled>Send B to A</button>
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
      color-scheme: light;
      --bg: #f8f3e8;
      --panel: #fff8ef;
      --ink: #1c1b1a;
      --muted: #6b6258;
      --accent: #f0542d;
      --accent-2: #1b8f76;
      --ring: rgba(240, 84, 45, 0.4);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 20% 10%, rgba(255, 211, 150, 0.45), transparent 45%),
        radial-gradient(circle at 80% 0%, rgba(124, 214, 196, 0.35), transparent 40%),
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
      margin-bottom: 32px;
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
      margin: 0 0 8px;
    }

    .sub {
      margin: 0;
      color: var(--muted);
    }

    .actions {
      display: flex;
      gap: 12px;
    }

    button {
      border: 0;
      padding: 10px 18px;
      border-radius: 999px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    button:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    button.primary {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 8px 20px rgba(240, 84, 45, 0.25);
    }

    button.ghost {
      background: rgba(0, 0, 0, 0.05);
      color: var(--ink);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .grid {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .card {
      background: var(--panel);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .card-header h2 {
      margin: 0 0 8px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ccc;
    }

    .controls {
      display: flex;
      gap: 12px;
    }

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
  pcAStateDot: document.querySelector<HTMLSpanElement>("#pcAState")!,
  pcBStateDot: document.querySelector<HTMLSpanElement>("#pcBState")!,
  dcAStateDot: document.querySelector<HTMLSpanElement>("#dcAState")!,
  dcBStateDot: document.querySelector<HTMLSpanElement>("#dcBState")!,
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
  const dot = state === "connected" ? "var(--accent-2)" : "#f5b84f";
  if (peer === "A") {
    ui.pcAText.textContent = text;
    ui.pcAStateDot.style.background = dot;
    return;
  }
  ui.pcBText.textContent = text;
  ui.pcBStateDot.style.background = dot;
};

export const updateDcStatus = (
  ui: UIRefs,
  peer: PeerLabel,
  state: RTCDataChannelState | "idle",
  peerState: PeerState,
) => {
  const text = `DataChannel: ${state}`;
  const dot = state === "open" ? "var(--accent-2)" : "#f5b84f";
  if (peer === "A") {
    ui.dcAText.textContent = text;
    ui.dcAStateDot.style.background = dot;
  } else {
    ui.dcBText.textContent = text;
    ui.dcBStateDot.style.background = dot;
  }

  const isOpenA = peerState.dcA?.readyState === "open";
  const isOpenB = peerState.dcB?.readyState === "open";
  ui.sendAButton.disabled = !isOpenA;
  ui.sendBButton.disabled = !isOpenB;
};

