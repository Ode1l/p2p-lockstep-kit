import type { WebRTCTransport } from "../../../src/transport/webrtcTransport";

export type PeerState = {
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  transport: WebRTCTransport | null;
};

export type PeerHandlers = {
  log: (message: string) => void;
  updatePcStatus: (state: RTCPeerConnectionState | "idle") => void;
  updateDcStatus: (state: RTCDataChannelState | "idle") => void;
};
