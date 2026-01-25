export const iceConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export const dataChannelConfig: RTCDataChannelInit = {
  ordered: true,
};