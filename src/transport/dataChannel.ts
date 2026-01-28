import type { rtcPeerCore } from './peerTypes';

const log = (id: string, message: string, level: 'info' | 'warn' = 'info') => {
  if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(`[rtc:${id}] ${message}`);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[rtc:${id}] ${message}`);
};

export const attachMessage = (core: rtcPeerCore, channel: RTCDataChannel) => {
  channel.onmessage = (event) => {
    const text = String(event.data);
    core.inbox.push(text);
    log(core.id, `received: ${text}`);
  };
};

export const listenChannel = (
  core: rtcPeerCore,
  setDc: (channel: RTCDataChannel) => void,
) => {
  core.pc.ondatachannel = (event) => {
    setDc(event.channel);
    attachMessage(core, event.channel);
  };
  log(core.id, 'listening for datachannel');
};

export const createDataChannel = (
  core: rtcPeerCore,
  setDc: (channel: RTCDataChannel) => void,
) => {
  const channel = core.pc.createDataChannel('test', { ordered: true });
  setDc(channel);
  log(core.id, 'created dataChannel');
  attachMessage(core, channel);
  return channel;
};

export const sendOnChannel = (core: rtcPeerCore, data: string) => {
  if (!core.dc || core.dc.readyState !== 'open') {
    log(core.id, 'send blocked: dc not open', 'warn');
    return;
  }
  core.dc.send(data);
  log(core.id, `sent: ${data}`);
};

// const pc = new RTCPeerConnection();
// const dc = pc.createDataChannel('my channel');
//
// dc.onmessage = (event) => {
//   console.log(`received: ${event.data}`);
// };
//
// dc.onopen = () => {
//   console.log('datachannel open');
// };
//
// dc.onclose = () => {
//   console.log('datachannel close');
// };