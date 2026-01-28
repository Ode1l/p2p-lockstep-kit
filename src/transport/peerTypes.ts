export type rtcPeer = {
  id: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  inbox: string[];
  listenChannel: () => void;
  setSignaling: (sender: SignalSender, polite: boolean) => void;
  handleSignalMessage: (message: SignalMessage) => Promise<void>;
  linkIce: (target: rtcPeer) => void;
  receiveIce: (candidate: RTCIceCandidate) => Promise<void>;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  acceptOffer: (
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescriptionInit>;
  acceptAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  send: (data: string) => void;
  close: () => void;
};

export type rtcPeerCore = {
  id: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  inbox: string[];
};

export type SignalMessage = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export type SignalSender = (message: SignalMessage) => void;
