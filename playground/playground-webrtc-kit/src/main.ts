import { dataChannelConfig, iceConfig } from "./config";
import { closePair, createPair, createPeerState, createTransportState } from "./rtc";
import type { PeerLabel } from "./types";
import {
  getUIRefs,
  injectStyles,
  log as logToUI,
  renderApp,
  resetLogs,
  updateDcStatus as updateDcStatusUI,
  updatePcStatus as updatePcStatusUI,
} from "./ui";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

renderApp(app);
injectStyles();

const ui = getUIRefs();
const peerState = createPeerState();
const transportState = createTransportState();

const shouldLogToUI = (message: string) =>
  message.startsWith("sent:") || message.startsWith("received:") || message.includes("open");

const handlers = {
  log: (peer: PeerLabel, message: string) => {
    // Detailed network logs go to the console; UI log stays user-facing.
    // eslint-disable-next-line no-console
    console.log(`[Peer ${peer}] ${message}`);
    if (shouldLogToUI(message)) {
      logToUI(ui, peer, message);
    }
  },
  updatePcStatus: (peer: PeerLabel, state: RTCPeerConnectionState | "idle") =>
    updatePcStatusUI(ui, peer, state),
  updateDcStatus: (peer: PeerLabel, state: RTCDataChannelState | "idle") =>
    updateDcStatusUI(ui, peer, state, peerState),
  onReset: () => resetLogs(ui),
};

const sendMessage = (peer: PeerLabel) => {
  const transport = peer === "A" ? transportState.transportA : transportState.transportB;
  const input = peer === "A" ? ui.inputA : ui.inputB;
  const text = input.value.trim();
  if (!text || !transport || transport.state !== "open") {
    return;
  }
  transport.send(text);
  handlers.log(peer, `sent: ${text}`);
  input.value = "";
};

ui.createPairButton.addEventListener("click", () => {
  void createPair(peerState, transportState, iceConfig, dataChannelConfig, handlers);
});

ui.resetPairButton.addEventListener("click", () => {
  closePair(peerState, transportState, handlers);
});

ui.sendAButton.addEventListener("click", () => sendMessage("A"));
ui.sendBButton.addEventListener("click", () => sendMessage("B"));

ui.inputA.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage("A");
  }
});

ui.inputB.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage("B");
  }
});

handlers.updatePcStatus("A", "idle");
handlers.updatePcStatus("B", "idle");
handlers.updateDcStatus("A", "idle");
handlers.updateDcStatus("B", "idle");