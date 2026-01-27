import { configuration } from './configuration';
type RtcPeer = {
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


const createRtcPeer = (id: string): RtcPeer => {
  const pc = new RTCPeerConnection(configuration);
  let dc: RTCDataChannel | null = null;
  const inbox: string[] = [];
  let pendingCandidates: RTCIceCandidate[] = [];

  // listen for connection state changes
  pc.onconnectionstatechange = () => {
    console.log(`[rtc:${id}] pc change. state: ${pc.connectionState}`);
  };

  const listenMessage = (channel: RTCDataChannel) => {
    channel.onmessage = (event) => {
      const text = String(event.data);
      inbox.push(text);
      // eslint-disable-next-line no-console
      console.log(`[rtc:${id}] received: ${text}`);
    };
  };

  const listenChannel = () => {
    pc.ondatachannel = (event) => {
      dc = event.channel;
      listenMessage(event.channel);
    };
    // eslint-disable-next-line no-console
    console.log(`[rtc:${id}] listening for datachannel`);
  };

  const createOffer = async () => {
    dc = pc.createDataChannel('test', { ordered: true });
    console.log(`[rtc:${id}] created dataChannel`);
    listenMessage(dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // eslint-disable-next-line no-console
    console.log(`[rtc:${id}] created offer`);
    return offer;
  };

  const acceptOffer = async (offer: RTCSessionDescriptionInit) => {
    await pc.setRemoteDescription(offer);
    await flushIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    // eslint-disable-next-line no-console
    console.log(`[rtc:${id}] accepted offer, created answer`);
    return answer;
  };

  const acceptAnswer = async (answer: RTCSessionDescriptionInit) => {
    await pc.setRemoteDescription(answer);
    await flushIce();
    // eslint-disable-next-line no-console
    console.log(`[rtc:${id}] accepted answer`);
  };

  const receiveIce = async (candidate: RTCIceCandidate) => {
    if (pc.remoteDescription) {
      await pc.addIceCandidate(candidate);
      return;
    }
    pendingCandidates.push(candidate);
  };

  const flushIce = async () => {
    if (!pc.remoteDescription || pendingCandidates.length === 0) {
      return;
    }
    const queue = pendingCandidates;
    pendingCandidates = [];
    for (const candidate of queue) {
      await pc.addIceCandidate(candidate);
    }
  };

  const linkIce = (target: RtcPeer) => {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void target.receiveIce(event.candidate);
      }
    };
    // eslint-disable-next-line no-console
    console.log(`[rtc:${id}] ICE linked -> ${target.id}`);
  };

  const send = (data: string) => {
    if (!dc || dc.readyState !== "open") {
      // eslint-disable-next-line no-console
      console.warn(`[rtc:${id}] send blocked: dc not open`);
      return;
    }
    dc.send(data);
    // eslint-disable-next-line no-console
    console.log(`[rtc:${id}] sent: ${data}`);
  };

  const close = () => {
    dc?.close();
    pc.close();
    // eslint-disable-next-line no-console
    console.log(`[rtc:${id}] closed`);
  };

  return {
    id,
    pc,
    get dc() {
      return dc;
    },
    inbox,
    listenChannel,
    linkIce,
    receiveIce,
    createOffer,
    acceptOffer,
    acceptAnswer,
    send,
    close,
  };
};

const factory = {
  newPeer: (id: string) => createRtcPeer(id),
};

(window as any).debug = {
  factory,
};

// Test flow (run in DevTools console):
// const a = window.debug.factory.newPeer("A");
// const b = window.debug.factory.newPeer("B");
// a.linkIce(b);
// b.linkIce(a);
// b.listenChannel();
// const offer = await a.createOffer();
// const answer = await b.acceptOffer(offer);
// await a.acceptAnswer(answer);
// a.send("hello");