export type RtcPeer = {
  id: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  inbox: string[];
  listenChannel: () => void;
  linkIce: (target: RtcPeer) => void;
  receiveIce: (candidate: RTCIceCandidate) => Promise<void>;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  acceptOffer: (
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescriptionInit>;
  acceptAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  send: (data: string) => void;
  close: () => void;
};
