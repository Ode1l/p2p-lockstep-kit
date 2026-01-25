import { createWebRTCTransport } from "../../../src/transport/webrtcTransport";
import type { WebRTCTransport } from "../../../src/transport/webrtcTransport";
import type { PeerLabel, PeerState } from "./types";

export type RTCHandlers = {
  log: (peer: PeerLabel, message: string) => void;
  updatePcStatus: (peer: PeerLabel, state: RTCPeerConnectionState | "idle") => void;
  updateDcStatus: (peer: PeerLabel, state: RTCDataChannelState | "idle") => void;
  onReset?: () => void;
};

export type TransportState = {
  transportA: WebRTCTransport | null;
  transportB: WebRTCTransport | null;
};

export const createPeerState = (): PeerState => ({
  pcA: null,
  pcB: null,
  dcA: null,
  dcB: null,
});

export const createTransportState = (): TransportState => ({
  transportA: null,
  transportB: null,
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
  peer: PeerLabel,
  transport: WebRTCTransport,
  handlers: RTCHandlers,
) => {
  transport.on("state", ({ state }) =>
    handlers.updateDcStatus(peer, mapTransportStateToDcState(state)),
  );
  transport.on("open", () => handlers.log(peer, "DataChannel open"));
  transport.on("close", ({ reason }) => handlers.log(peer, `DataChannel close${reason ? `: ${reason}` : ""}`));
  transport.on("error", ({ error }) => handlers.log(peer, `Transport error: ${String(error)}`));
  transport.on("message", ({ data }) => handlers.log(peer, `received: ${data}`));
};

export const closePair = (
  peerState: PeerState,
  transportState: TransportState,
  handlers: RTCHandlers,
) => {
  transportState.transportA?.close("reset");
  transportState.transportB?.close("reset");
  transportState.transportA = null;
  transportState.transportB = null;

  peerState.dcA?.close();
  peerState.dcB?.close();
  peerState.pcA?.close();
  peerState.pcB?.close();

  peerState.dcA = null;
  peerState.dcB = null;
  peerState.pcA = null;
  peerState.pcB = null;

  handlers.updatePcStatus("A", "idle");
  handlers.updatePcStatus("B", "idle");
  handlers.updateDcStatus("A", "idle");
  handlers.updateDcStatus("B", "idle");
  handlers.onReset?.();
};

export const createPair = async (
  peerState: PeerState,
  transportState: TransportState,
  iceConfig: RTCConfiguration,
  dataChannelConfig: RTCDataChannelInit,
  handlers: RTCHandlers,
) => {
  closePair(peerState, transportState, handlers);

  peerState.pcA = new RTCPeerConnection(iceConfig);
  peerState.pcB = new RTCPeerConnection(iceConfig);

  peerState.pcA.onconnectionstatechange = () => {
    handlers.updatePcStatus("A", peerState.pcA?.connectionState ?? "idle");
    handlers.log("A", `connectionState=${peerState.pcA?.connectionState ?? "idle"}`);
  };
  peerState.pcB.onconnectionstatechange = () => {
    handlers.updatePcStatus("B", peerState.pcB?.connectionState ?? "idle");
    handlers.log("B", `connectionState=${peerState.pcB?.connectionState ?? "idle"}`);
  };

  peerState.pcA.onicecandidate = (event) => {
    if (event.candidate) {
      void peerState.pcB?.addIceCandidate(event.candidate);
    }
  };
  peerState.pcB.onicecandidate = (event) => {
    if (event.candidate) {
      void peerState.pcA?.addIceCandidate(event.candidate);
    }
  };

  peerState.dcA = peerState.pcA.createDataChannel("game", dataChannelConfig);
  transportState.transportA = createWebRTCTransport(peerState.dcA);
  wireTransport("A", transportState.transportA, handlers);

  peerState.pcB.ondatachannel = (event) => {
    peerState.dcB = event.channel;
    transportState.transportB = createWebRTCTransport(peerState.dcB);
    wireTransport("B", transportState.transportB, handlers);
  };

  const offer = await peerState.pcA.createOffer();
  await peerState.pcA.setLocalDescription(offer);
  await peerState.pcB.setRemoteDescription(offer);
  const answer = await peerState.pcB.createAnswer();
  await peerState.pcB.setLocalDescription(answer);
  await peerState.pcA.setRemoteDescription(answer);

  handlers.updatePcStatus("A", peerState.pcA.connectionState);
  handlers.updatePcStatus("B", peerState.pcB.connectionState);
  handlers.log("A", "pair created; negotiating...");
  handlers.log("B", "pair created; negotiating...");
};
