// Net Adapter (net): provides a session-facing API over signaling + RTC client.
// Responsibilities:
// - Translate raw messages into envelopes for the session router.
// - Expose register/connect/send/disconnect and connection state hooks.
import { createClient } from "../network";
import {
  resolveMessageDomain,
  type MessageType,
  type WireEnvelope as Envelope,
} from "../utils";

export type NetAdapter = {
  register: (url: string) => Promise<{ peerId: string }>;
  connect: (targetId: string) => Promise<void>;
  disconnect: () => void;
  send: <T>(msg: Envelope<T>) => void;
  onMessage: (handler: (msg: Envelope) => void) => void;
  onConnectionState: (handler: (state: RTCPeerConnectionState) => void) => void;
  state: () => {
    connectionState: RTCPeerConnectionState;
    iceConnectionState: RTCIceConnectionState;
    signalingState: RTCSignalingState;
  };
};

export const createNetClient = (): NetAdapter => {
  const client = createClient();
  const onMessage = (handler: (msg: Envelope) => void) => {
    client.onMessage((raw) => {
      try {
        const msg = JSON.parse(String(raw)) as Envelope;
        if (msg && typeof msg.type === "string") {
          const type = msg.type as MessageType;
          handler({
            ...msg,
            type,
            domain: resolveMessageDomain({ type, domain: msg.domain }),
          });
        }
      } catch {
        // ignore parse errors
      }
    });
  };

  const send = <T>(msg: Envelope<T>) => {
    client.send(JSON.stringify(msg));
  };

  return {
    register: client.register,
    connect: client.connect,
    disconnect: client.disconnect,
    send,
    onMessage,
    onConnectionState: client.onConnectionState,
    state: client.pcState,
  };
};

export const createEnvelope = <T>(
  msg: Envelope<T>,
): Envelope<T> => ({
  ...msg,
  domain: resolveMessageDomain({ type: msg.type, domain: msg.domain }),
});
