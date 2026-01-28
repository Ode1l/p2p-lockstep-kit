import { configuration } from "./configuration";
import { createLocalSignaling } from "./signaling";
import { createPeer } from "./peer";

const signaling = createLocalSignaling();

const createPeerNode = (id: string) => {
  const pc = new RTCPeerConnection(configuration);
  return createPeer(id, pc, signaling);
};

(window as any).debug = {
  signaling,
  createPeer: createPeerNode,
};

// Example (run in console):
// const a = window.debug.createPeer("A");
// const b = window.debug.createPeer("B");
// a.connect("B");
