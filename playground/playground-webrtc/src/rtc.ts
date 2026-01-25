import type { PeerLabel, PeerState } from "./types";

export type RTCHandlers = {
  log: (peer: PeerLabel, message: string) => void;
  updatePcStatus: (peer: PeerLabel, state: RTCPeerConnectionState | "idle") => void;
  updateDcStatus: (peer: PeerLabel, state: RTCDataChannelState | "idle") => void;
  onReset?: () => void;
};

export const createPeerState = (): PeerState => ({
  pcA: null,
  pcB: null,
  dcA: null,
  dcB: null,
});

const describeCandidate = (candidate: RTCIceCandidate) => {
  const c = candidate.candidate;
  const typeMatch = c.match(/ typ ([a-z]+)/);
  const addrMatch = c.match(
    /candidate:\S+ \d+ (udp|tcp) \d+ ([^ ]+) (\d+) typ [a-z]+/i,
  );
  const typ = typeMatch?.[1] ?? "unknown";
  const proto = addrMatch?.[1]?.toLowerCase() ?? "udp";
  const addr = addrMatch?.[2] ?? "?";
  const port = addrMatch?.[3] ?? "?";
  return `${typ} ${proto} ${addr}:${port}`;
};

const setupDataChannel = (
  peer: PeerLabel,
  channel: RTCDataChannel,
  handlers: RTCHandlers,
) => {
  channel.onopen = () => handlers.updateDcStatus(peer, channel.readyState);
  channel.onclose = () => handlers.updateDcStatus(peer, channel.readyState);
  channel.onerror = () => handlers.log(peer, "DataChannel error");
  channel.onmessage = (event) => {
    handlers.log(peer, `received: ${String(event.data)}`);
  };
  handlers.log(peer, `DataChannel created: label=${channel.label}`);
  handlers.updateDcStatus(peer, channel.readyState);
};

export const closePair = (peerState: PeerState, handlers: RTCHandlers) => {
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
  iceConfig: RTCConfiguration,
  dataChannelConfig: RTCDataChannelInit,
  handlers: RTCHandlers,
) => {
  closePair(peerState, handlers);

  peerState.pcA = new RTCPeerConnection(iceConfig);
  peerState.pcB = new RTCPeerConnection(iceConfig);

  peerState.pcA.onicecandidate = (event) => {
    if (event.candidate) {
      handlers.log("A", `ICE candidate -> B: ${describeCandidate(event.candidate)}`);
      void peerState.pcB?.addIceCandidate(event.candidate);
      handlers.log("B", `ICE candidate added from A: ${describeCandidate(event.candidate)}`);
    }
  };
  peerState.pcB.onicecandidate = (event) => {
    if (event.candidate) {
      handlers.log("B", `ICE candidate -> A: ${describeCandidate(event.candidate)}`);
      void peerState.pcA?.addIceCandidate(event.candidate);
      handlers.log("A", `ICE candidate added from B: ${describeCandidate(event.candidate)}`);
    }
  };

  peerState.pcA.onconnectionstatechange = () => {
    handlers.updatePcStatus("A", peerState.pcA?.connectionState ?? "idle");
    handlers.log("A", `connectionState=${peerState.pcA?.connectionState ?? "idle"}`);
  };
  peerState.pcB.onconnectionstatechange = () => {
    handlers.updatePcStatus("B", peerState.pcB?.connectionState ?? "idle");
    handlers.log("B", `connectionState=${peerState.pcB?.connectionState ?? "idle"}`);
  };

  peerState.pcA.onsignalingstatechange = () => {
    handlers.log("A", `signalingState=${peerState.pcA?.signalingState ?? "idle"}`);
  };
  peerState.pcB.onsignalingstatechange = () => {
    handlers.log("B", `signalingState=${peerState.pcB?.signalingState ?? "idle"}`);
  };

  peerState.pcA.oniceconnectionstatechange = () => {
    handlers.log("A", `iceConnectionState=${peerState.pcA?.iceConnectionState ?? "idle"}`);
  };
  peerState.pcB.oniceconnectionstatechange = () => {
    handlers.log("B", `iceConnectionState=${peerState.pcB?.iceConnectionState ?? "idle"}`);
  };

  peerState.pcA.onicegatheringstatechange = () => {
    handlers.log("A", `iceGatheringState=${peerState.pcA?.iceGatheringState ?? "idle"}`);
  };
  peerState.pcB.onicegatheringstatechange = () => {
    handlers.log("B", `iceGatheringState=${peerState.pcB?.iceGatheringState ?? "idle"}`);
  };

  peerState.dcA = peerState.pcA.createDataChannel("chat", dataChannelConfig);
  setupDataChannel("A", peerState.dcA, handlers);

  peerState.pcB.ondatachannel = (event) => {
    peerState.dcB = event.channel;
    setupDataChannel("B", peerState.dcB, handlers);
  };

  const offer = await peerState.pcA.createOffer();
  await peerState.pcA.setLocalDescription(offer);
  handlers.log("A", `setLocalDescription: type=${offer.type}`);
  await peerState.pcB.setRemoteDescription(offer);
  handlers.log("B", `setRemoteDescription: type=${offer.type}`);
  const answer = await peerState.pcB.createAnswer();
  await peerState.pcB.setLocalDescription(answer);
  handlers.log("B", `setLocalDescription: type=${answer.type}`);
  await peerState.pcA.setRemoteDescription(answer);
  handlers.log("A", `setRemoteDescription: type=${answer.type}`);

  handlers.updatePcStatus("A", peerState.pcA.connectionState);
  handlers.updatePcStatus("B", peerState.pcB.connectionState);
  handlers.log("A", "pair created; DataChannel negotiating...");
  handlers.log("B", "pair created; DataChannel negotiating...");
};
