import type { rtcPeerCore } from "./peerTypes";

// Session Description Protocol

const log = (id: string, message: string) => {
  // eslint-disable-next-line no-console
  console.log(`[rtc:${id}] ${message}`);
};

export const createSdpHandlers = (
  core: rtcPeerCore,
  createChannel: () => void,
) => {
  const createOffer = async () => {
    createChannel();
    const offer = await core.pc.createOffer();
    await core.pc.setLocalDescription(offer);
    log(core.id, "created offer");
    return offer;
  };

  const acceptOffer = async (offer: RTCSessionDescriptionInit) => {
    await core.pc.setRemoteDescription(offer);
    const answer = await core.pc.createAnswer();
    await core.pc.setLocalDescription(answer);
    log(core.id, "accepted offer, created answer");
    return answer;
  };

  const acceptAnswer = async (answer: RTCSessionDescriptionInit) => {
    await core.pc.setRemoteDescription(answer);
    log(core.id, "accepted answer");
  };

  return { createOffer, acceptOffer, acceptAnswer };
};
