import { signalingUrl } from "./configuration";
import { createClient } from "../../../src";

const registerBtn = document.querySelector<HTMLButtonElement>("#registerBtn");
const connectBtn = document.querySelector<HTMLButtonElement>("#connectBtn");
const disconnectBtn = document.querySelector<HTMLButtonElement>("#disconnectBtn");
const sendBtn = document.querySelector<HTMLButtonElement>("#sendBtn");
const stateBtn = document.querySelector<HTMLButtonElement>("#stateBtn");
const peerIdEl = document.querySelector<HTMLSpanElement>("#peerId");
const targetIdInput = document.querySelector<HTMLInputElement>("#targetId");
const messageInput = document.querySelector<HTMLInputElement>("#message");
const logEl = document.querySelector<HTMLPreElement>("#log");

if (
  !registerBtn ||
  !connectBtn ||
  !disconnectBtn ||
  !sendBtn ||
  !stateBtn ||
  !peerIdEl ||
  !targetIdInput ||
  !messageInput ||
  !logEl
) {
  throw new Error("UI elements not found");
}

const client = createClient();

const log = (line: string) => {
  logEl.textContent += `${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
};

registerBtn.addEventListener("click", async () => {
  const { peerId } = await client.register(signalingUrl);
  peerIdEl.textContent = peerId;
  log(`[register] peerId=${peerId}`);
});

client.onMessage((data) => {
  log(`[recv] ${String(data)}`);
});

connectBtn.addEventListener("click", async () => {
  const targetId = targetIdInput.value.trim();
  if (!targetId) {
    return;
  }
  await client.connect(targetId);
  log(`[connect] -> ${targetId}`);
});

disconnectBtn.addEventListener("click", () => {
  client.disconnect();
  log("[disconnect]");
});

sendBtn.addEventListener("click", () => {
  const text = messageInput.value.trim();
  if (!text) {
    return;
  }
  client.send(text);
  log(`[send] ${text}`);
  messageInput.value = "";
});

stateBtn.addEventListener("click", () => {
  const state = client.pcState();
  log(`[pc] ${state.connectionState} / ${state.iceConnectionState} / ${state.signalingState}`);
});

(window as any).debug = { client };
