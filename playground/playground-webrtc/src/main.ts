const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("#app not found");
}

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

type PeerLabel = "A" | "B";

const createPairButton = document.querySelector<HTMLButtonElement>("#createPair")!;
const resetPairButton = document.querySelector<HTMLButtonElement>("#resetPair")!;
const sendAButton = document.querySelector<HTMLButtonElement>("#sendA")!;
const sendBButton = document.querySelector<HTMLButtonElement>("#sendB")!;
const inputA = document.querySelector<HTMLInputElement>("#inputA")!;
const inputB = document.querySelector<HTMLInputElement>("#inputB")!;
const logA = document.querySelector<HTMLPreElement>("#logA")!;
const logB = document.querySelector<HTMLPreElement>("#logB")!;
const pcAText = document.querySelector<HTMLSpanElement>("#pcAText")!;
const pcBText = document.querySelector<HTMLSpanElement>("#pcBText")!;
const dcAText = document.querySelector<HTMLSpanElement>("#dcAText")!;
const dcBText = document.querySelector<HTMLSpanElement>("#dcBText")!;
const pcAStateDot = document.querySelector<HTMLSpanElement>("#pcAState")!;
const pcBStateDot = document.querySelector<HTMLSpanElement>("#pcBState")!;
const dcAStateDot = document.querySelector<HTMLSpanElement>("#dcAState")!;
const dcBStateDot = document.querySelector<HTMLSpanElement>("#dcBState")!;

let pcA: RTCPeerConnection | null = null;
let pcB: RTCPeerConnection | null = null;
let dcA: RTCDataChannel | null = null;
let dcB: RTCDataChannel | null = null;

const log = (peer: PeerLabel, message: string) => {
  const target = peer === "A" ? logA : logB;
  const timestamp = new Date().toLocaleTimeString();
  target.textContent += `[${timestamp}] ${message}\n`;
  target.scrollTop = target.scrollHeight;
};

const updatePcStatus = (peer: PeerLabel, state: RTCPeerConnectionState | "idle") => {
  const text = `RTCPeerConnection: ${state}`;
  if (peer === "A") {
    pcAText.textContent = text;
    pcAStateDot.style.background = state === "connected" ? "var(--accent-2)" : "#f5b84f";
  } else {
    pcBText.textContent = text;
    pcBStateDot.style.background = state === "connected" ? "var(--accent-2)" : "#f5b84f";
  }
};

const updateDcStatus = (peer: PeerLabel, state: RTCDataChannelState | "idle") => {
  const text = `DataChannel: ${state}`;
  const dot = state === "open" ? "var(--accent-2)" : "#f5b84f";
  if (peer === "A") {
    dcAText.textContent = text;
    dcAStateDot.style.background = dot;
  } else {
    dcBText.textContent = text;
    dcBStateDot.style.background = dot;
  }
  const isOpenA = dcA?.readyState === "open";
  const isOpenB = dcB?.readyState === "open";
  sendAButton.disabled = !isOpenA;
  sendBButton.disabled = !isOpenB;
};

const setupDataChannel = (peer: PeerLabel, channel: RTCDataChannel) => {
  channel.onopen = () => updateDcStatus(peer, channel.readyState);
  channel.onclose = () => updateDcStatus(peer, channel.readyState);
  channel.onerror = () => log(peer, "DataChannel error");
  channel.onmessage = (event) => {
    log(peer, `received: ${event.data}`);
  };
  updateDcStatus(peer, channel.readyState);
};

const closePair = () => {
  dcA?.close();
  dcB?.close();
  pcA?.close();
  pcB?.close();
  dcA = null;
  dcB = null;
  pcA = null;
  pcB = null;
  updatePcStatus("A", "idle");
  updatePcStatus("B", "idle");
  updateDcStatus("A", "idle");
  updateDcStatus("B", "idle");
  logA.textContent = "";
  logB.textContent = "";
};

const createPair = async () => {
  closePair();

  pcA = new RTCPeerConnection();
  pcB = new RTCPeerConnection();

  pcA.onicecandidate = (event) => {
    if (event.candidate) {
      void pcB?.addIceCandidate(event.candidate);
    }
  };
  pcB.onicecandidate = (event) => {
    if (event.candidate) {
      void pcA?.addIceCandidate(event.candidate);
    }
  };

  pcA.onconnectionstatechange = () => {
    updatePcStatus("A", pcA?.connectionState ?? "idle");
  };
  pcB.onconnectionstatechange = () => {
    updatePcStatus("B", pcB?.connectionState ?? "idle");
  };

  dcA = pcA.createDataChannel("chat", { ordered: true });
  setupDataChannel("A", dcA);

  pcB.ondatachannel = (event) => {
    dcB = event.channel;
    setupDataChannel("B", dcB);
  };

  const offer = await pcA.createOffer();
  await pcA.setLocalDescription(offer);
  await pcB.setRemoteDescription(offer);
  const answer = await pcB.createAnswer();
  await pcB.setLocalDescription(answer);
  await pcA.setRemoteDescription(answer);

  updatePcStatus("A", pcA.connectionState);
  updatePcStatus("B", pcB.connectionState);
  log("A", "pair created; DataChannel negotiating...");
  log("B", "pair created; DataChannel negotiating...");
};

const sendMessage = (peer: PeerLabel) => {
  const channel = peer === "A" ? dcA : dcB;
  const input = peer === "A" ? inputA : inputB;
  const text = input.value.trim();
  if (!text || !channel || channel.readyState !== "open") {
    return;
  }
  channel.send(text);
  log(peer, `sent: ${text}`);
  input.value = "";
};

createPairButton.addEventListener("click", () => {
  void createPair();
});

resetPairButton.addEventListener("click", () => {
  closePair();
});

sendAButton.addEventListener("click", () => sendMessage("A"));
sendBButton.addEventListener("click", () => sendMessage("B"));

inputA.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage("A");
  }
});

inputB.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage("B");
  }
});

updatePcStatus("A", "idle");
updatePcStatus("B", "idle");
updateDcStatus("A", "idle");
updateDcStatus("B", "idle");
