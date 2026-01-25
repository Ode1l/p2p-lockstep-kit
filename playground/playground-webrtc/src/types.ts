export type PeerLabel = "A" | "B";

export type PeerState = {
  pcA: RTCPeerConnection | null;
  pcB: RTCPeerConnection | null;
  dcA: RTCDataChannel | null;
  dcB: RTCDataChannel | null;
};

