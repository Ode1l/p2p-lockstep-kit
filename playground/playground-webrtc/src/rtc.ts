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
      void peerState.pcB?.addIceCandidate(event.candidate);
    }
  };
  peerState.pcB.onicecandidate = (event) => {
    if (event.candidate) {
      void peerState.pcA?.addIceCandidate(event.candidate);
    }
  };

  peerState.pcA.onconnectionstatechange = () => {
    handlers.updatePcStatus("A", peerState.pcA?.connectionState ?? "idle");
  };
  peerState.pcB.onconnectionstatechange = () => {
    handlers.updatePcStatus("B", peerState.pcB?.connectionState ?? "idle");
  };

  peerState.dcA = peerState.pcA.createDataChannel("chat", dataChannelConfig);
  setupDataChannel("A", peerState.dcA, handlers);

  peerState.pcB.ondatachannel = (event) => {
    peerState.dcB = event.channel;
    setupDataChannel("B", peerState.dcB, handlers);
  };

  const offer = await peerState.pcA.createOffer();
  await peerState.pcA.setLocalDescription(offer);
  await peerState.pcB.setRemoteDescription(offer);
  const answer = await peerState.pcB.createAnswer();
  await peerState.pcB.setLocalDescription(answer);
  await peerState.pcA.setRemoteDescription(answer);

  handlers.updatePcStatus("A", peerState.pcA.connectionState);
  handlers.updatePcStatus("B", peerState.pcB.connectionState);
  handlers.log("A", "pair created; DataChannel negotiating...");
  handlers.log("B", "pair created; DataChannel negotiating...");
};

