import { createWebRTCTransport } from "../../../src/transport/webrtcTransport";
import type { WebRTCTransport } from "../../../src/transport/webrtcTransport";
import type { SignalingClient } from "./signaling";
import type { PeerHandlers, PeerState } from "./types";

export type RTCControls = {
  startOffer: () => Promise<void>;
  dispose: () => void;
};

export const createPeerState = (): PeerState => ({
  pc: null,
  dc: null,
  transport: null,
});

const mapTransportStateToDcState = (
  state: "idle" | "connecting" | "open" | "closing" | "closed" | "error",
): RTCDataChannelState | "idle" => {
  switch (state) {
    case "idle":
      return "idle";
    case "connecting":
      return "connecting";
    case "open":
      return "open";
    case "closing":
      return "closing";
    case "closed":
    case "error":
    default:
      return "closed";
  }
};

const wireTransport = (
  transport: WebRTCTransport,
  handlers: PeerHandlers,
) => {
  const unsubs = [
    transport.on("state", ({ state }) =>
      handlers.updateDcStatus(mapTransportStateToDcState(state)),
    ),
    transport.on("open", () => handlers.log("DataChannel open")),
    transport.on("close", ({ reason }) =>
      handlers.log(`DataChannel close${reason ? `: ${reason}` : ""}`),
    ),
    transport.on("error", ({ error }) =>
      handlers.log(`Transport error: ${String(error)}`),
    ),
    transport.on("message", ({ data }) => handlers.log(`received: ${data}`)),
    transport.on("log", ({ message }) => handlers.log(message)),
  ];
  return () => unsubs.forEach((off) => off());
};

export const closePeer = (peerState: PeerState, handlers: PeerHandlers) => {
  peerState.transport?.close("reset");
  peerState.transport = null;

  peerState.dc?.close();
  peerState.pc?.close();
  peerState.dc = null;
  peerState.pc = null;

  handlers.updatePcStatus("idle");
  handlers.updateDcStatus("idle");
};

export const createPeerConnection = (
  peerState: PeerState,
  iceConfig: RTCConfiguration,
  dataChannelConfig: RTCDataChannelInit,
  signaling: SignalingClient,
  targetId: string,
  handlers: PeerHandlers,
): RTCControls => {
  closePeer(peerState, handlers);

  const pc = new RTCPeerConnection(iceConfig);
  peerState.pc = pc;

  let cleanupTransport = () => {};
  let hasLocalChannel = false;
  let makingOffer = false;

  const attachChannel = (dc: RTCDataChannel) => {
    peerState.dc = dc;
    peerState.transport = createWebRTCTransport(dc, {
      label: signaling.peerId,
      logger: (msg) => handlers.log(msg),
    });
    cleanupTransport();
    cleanupTransport = wireTransport(peerState.transport, handlers);
  };

  pc.onconnectionstatechange = () => {
    handlers.updatePcStatus(pc.connectionState);
    handlers.log(`connectionState=${pc.connectionState}`);
  };

  pc.oniceconnectionstatechange = () => {
    handlers.log(`iceConnectionState=${pc.iceConnectionState}`);
  };

  pc.onicegatheringstatechange = () => {
    handlers.log(`iceGatheringState=${pc.iceGatheringState}`);
  };

  pc.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }
    signaling.send("ICE", targetId, event.candidate.toJSON());
  };

  pc.ondatachannel = (event) => {
    handlers.log(`ondatachannel: ${event.channel.label}`);
    attachChannel(event.channel);
  };

  const localChannel = pc.createDataChannel("game", dataChannelConfig);
  hasLocalChannel = true;
  handlers.log(`createDataChannel: ${localChannel.label}`);
  attachChannel(localChannel);

  const onOffer = signaling.on("offer", async ({ from, payload }) => {
    if (from !== targetId) {
      return;
    }
    try {
      handlers.log(`offer received from ${from}`);
      await pc.setRemoteDescription(payload);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signaling.send("ANSWER", targetId, answer);
      handlers.log("answer sent");
    } catch (err) {
      handlers.log(`offer handling error: ${String(err)}`);
    }
  });

  const onAnswer = signaling.on("answer", async ({ from, payload }) => {
    if (from !== targetId) {
      return;
    }
    try {
      handlers.log(`answer received from ${from}`);
      await pc.setRemoteDescription(payload);
    } catch (err) {
      handlers.log(`answer handling error: ${String(err)}`);
    }
  });

  const onIce = signaling.on("ice", async ({ from, payload }) => {
    if (from !== targetId) {
      return;
    }
    try {
      await pc.addIceCandidate(payload);
    } catch (err) {
      handlers.log(`ice handling error: ${String(err)}`);
    }
  });

  const startOffer = async () => {
    if (makingOffer) {
      return;
    }
    if (!hasLocalChannel) {
      handlers.log("startOffer blocked: no local channel");
      return;
    }
    try {
      makingOffer = true;
      handlers.log("creating offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signaling.send("OFFER", targetId, offer);
      handlers.log("offer sent");
    } catch (err) {
      handlers.log(`offer error: ${String(err)}`);
    } finally {
      makingOffer = false;
    }
  };

  handlers.updatePcStatus(pc.connectionState);
  handlers.updateDcStatus(peerState.transport?.state === "open" ? "open" : "connecting");

  return {
    startOffer,
    dispose: () => {
      onOffer();
      onAnswer();
      onIce();
      cleanupTransport();
    },
  };
};