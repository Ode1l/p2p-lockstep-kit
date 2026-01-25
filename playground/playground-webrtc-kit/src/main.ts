import { dataChannelConfig, iceConfig } from "./config";
import { createPeerConnection, createPeerState, closePeer } from "./rtc";
import { createSignalingClient } from "./signaling";
import type { RTCControls } from "./rtc";
import type { SignalingClient } from "./signaling";
import {
  getUIRefs,
  injectStyles,
  log as logToUI,
  renderApp,
  resetLogs,
  updateDcStatus as updateDcStatusUI,
  updatePcStatus as updatePcStatusUI,
  updatePeers,
  updateSignalState,
} from "./ui";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

renderApp(app);
injectStyles();

const ui = getUIRefs();
const peerState = createPeerState();

let signaling: SignalingClient | null = null;
let controls: RTCControls | null = null;
let hasStartedOffer = false;

const shouldLogToUI = (message: string) =>
  message.startsWith("sent:") ||
  message.startsWith("received:") ||
  message.includes("open") ||
  message.includes("close") ||
  message.includes("error");

const handlers = {
  log: (message: string) => {
    // eslint-disable-next-line no-console
    console.log(message);
    if (shouldLogToUI(message)) {
      logToUI(ui, message);
    }
  },
  updatePcStatus: (state: RTCPeerConnectionState | "idle") =>
    updatePcStatusUI(ui, state),
  updateDcStatus: (state: RTCDataChannelState | "idle") =>
    updateDcStatusUI(ui, state, peerState),
};

const disposeControls = () => {
  controls?.dispose();
  controls = null;
  hasStartedOffer = false;
};

const connectSignaling = () => {
  const url = ui.signalingUrlInput.value.trim();
  const peerId = ui.peerIdInput.value.trim();
  if (!url || !peerId) {
    handlers.log("signaling blocked: url and peerId are required");
    return;
  }

  signaling?.close();
  signaling = createSignalingClient(url, peerId, (msg) => handlers.log(msg));

  signaling.on("state", ({ state }) => updateSignalState(ui, state));
  signaling.on("peers", ({ peers }) => {
    updatePeers(ui, peers);
    maybeStartOffer(peers);
  });
  signaling.on("error", ({ error }) => handlers.log(`signaling error: ${String(error)}`));
  signaling.on("log", ({ message }) => handlers.log(message));
};

const maybeStartOffer = (peers: string[]) => {
  if (!signaling || !controls || hasStartedOffer) {
    return;
  }
  const targetId = ui.targetIdInput.value.trim();
  if (!targetId || !peers.includes(targetId)) {
    return;
  }
  const isInitiator = signaling.peerId < targetId;
  if (!isInitiator) {
    handlers.log(`waiting for offer from ${targetId}`);
    return;
  }
  hasStartedOffer = true;
  void controls.startOffer();
};

const connectPeer = () => {
  if (!signaling || signaling.state !== "open") {
    handlers.log("connect blocked: signaling is not open");
    return;
  }
  const targetId = ui.targetIdInput.value.trim();
  if (!targetId) {
    handlers.log("connect blocked: targetId is required");
    return;
  }

  disposeControls();
  controls = createPeerConnection(
    peerState,
    iceConfig,
    dataChannelConfig,
    signaling,
    targetId,
    handlers,
  );
  maybeStartOffer(signaling.peers);
};

const resetPeer = () => {
  disposeControls();
  closePeer(peerState, handlers);
  resetLogs(ui);
};

const sendMessage = () => {
  const transport = peerState.transport;
  const text = ui.input.value.trim();
  if (!text || !transport || transport.state !== "open") {
    return;
  }
  transport.send(text);
  handlers.log(`sent: ${text}`);
  ui.input.value = "";
};

ui.connectSignalButton.addEventListener("click", connectSignaling);
ui.connectPeerButton.addEventListener("click", connectPeer);
ui.resetPeerButton.addEventListener("click", resetPeer);
ui.sendButton.addEventListener("click", sendMessage);
ui.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

updateSignalState(ui, "idle");
updatePeers(ui, []);
handlers.updatePcStatus("idle");
handlers.updateDcStatus("idle");

// Debug hooks for DevTools console.
(window as any).debugRTC = {
  connectSignaling,
  connectPeer,
  resetPeer,
  send: (msg: string) => {
    ui.input.value = msg;
    sendMessage();
  },
  state: () => ({
    signaling: signaling?.state ?? "none",
    peers: signaling?.peers ?? [],
    pc: peerState.pc?.connectionState ?? "idle",
    dc: peerState.dc?.readyState ?? "idle",
    transport: peerState.transport?.state ?? "idle",
  }),
};