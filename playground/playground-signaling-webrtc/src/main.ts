import { signalingUrl } from "./configuration";
import { createSignalingClient } from "./signaling";
import { createPeer } from "./peer";

const createPeerNode = async () => {
  const signaling = createSignalingClient();
  await signaling.connect(signalingUrl);
  const { peerId, iceServers } = await signaling.register();
  const pc = new RTCPeerConnection({ iceServers });
  const peer = createPeer(peerId, pc, signaling);
  return { peerId, peer, signaling };
};

(window as any).debug = {
  createPeer: createPeerNode,
};

// Example (run in console):
// const a = await window.debug.createPeer();
// const b = await window.debug.createPeer();
// a.peer.connect(b.peerId);
// // send after dc open
// // a.peer.send("hello");
// // b.peer.send("hi");
// // check state
// // a.peer.getState();
// // a.peer.pc.connectionState;
// // a.peer.pc.iceConnectionState;
// // a.peer.pc.signalingState;
// // disconnect
// // a.peer.disconnect();
// passive receive after created, connect is active
// a.peer.send("hello");
// disconnect manually:
// a.peer.disconnect();
