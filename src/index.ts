import { createSignalingClient } from "./signaling/client";
import { createRtcPeer } from "./transport/rtcPeer";

export type Facade = {
  register: (url: string) => Promise<{ peerId: string }>;
  connect: (targetId: string) => Promise<void>;
  send: (data: string) => void;
  disconnect: () => void;
  onMessage: (handler: (data: unknown) => void) => void;
  pcState: () => {
    connectionState: RTCPeerConnectionState;
    iceConnectionState: RTCIceConnectionState;
    signalingState: RTCSignalingState;
  };
};

export const createClient = (): Facade => {
  const signaling = createSignalingClient();
  let peer: ReturnType<typeof createRtcPeer> | null = null;
  let onMessageHandler: ((data: unknown) => void) | null = null;

  const register = async (url: string) => {
    await signaling.connect(url);
    const { peerId, iceServers } = await signaling.register();
    const pc = new RTCPeerConnection({ iceServers });
    peer = createRtcPeer(peerId, pc, signaling, (data) => {
      onMessageHandler?.(data);
    });
    return { peerId };
  };

  const connect = async (targetId: string) => {
    if (!peer) {
      return;
    }
    await peer.connect(targetId);
  };

  const send = (data: string) => {
    peer?.send(data);
  };

  const disconnect = () => {
    peer?.disconnect();
  };

  const onMessage = (handler: (data: unknown) => void) => {
    onMessageHandler = handler;
  };

  const pcState = () => {
    const pc = peer?.getPc();
    return {
      connectionState: pc?.connectionState ?? "new",
      iceConnectionState: pc?.iceConnectionState ?? "new",
      signalingState: pc?.signalingState ?? "stable",
    };
  };

  return { register, connect, send, disconnect, onMessage, pcState };
};
