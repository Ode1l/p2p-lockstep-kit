import { encode, decodeSafe } from "../serialization";
import type { SignalMessage as WireMessage } from "../protocol";
import { Emitter } from "./emitter";

export type SignalType = "offer" | "answer" | "ice";

export type SignalMessage = {
  from: string;
  to: string;
  type: SignalType;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

export type SignalingClient = {
  connect: (url: string) => Promise<void>;
  register: () => Promise<{ peerId: string; iceServers: RTCIceServer[] }>;
  relay: (message: SignalMessage) => void;
  on: (event: "signal", handler: (message: SignalMessage) => void) => void;
  off: (event: "signal", handler: (message: SignalMessage) => void) => void;
  state: () => { peerId: string | null; ready: boolean };
};

type SignalingEvents = {
  signal: SignalMessage;
  registered: { peerId: string; iceServers: RTCIceServer[] };
  error: unknown;
};

export const createSignalingClient = (): SignalingClient => {
  let ws: WebSocket | null = null;
  let peerId: string | null = null;
  let ready = false;
  let registeredPayload: WireMessage["payload"] | undefined;
  // Observer pattern: internal event bus for signal/registered/error.
  const emitter = new Emitter<SignalingEvents>();

  const connect = (url: string) =>
    new Promise<void>((resolve) => {
      ws?.close();
      ws = new WebSocket(url);
      ws.addEventListener("open", () => {
        ready = true;
        registeredPayload = undefined;
        resolve();
      });
      ws.addEventListener("close", () => {
        ready = false;
        peerId = null;
        registeredPayload = undefined;
      });
      ws.addEventListener("message", (event) => {
        const raw = String(event.data);
        const decoded = decodeSafe<WireMessage>(raw);
        if (!decoded.ok) {
          emitter.emit("error", decoded.error);
          return;
        }
        const msg = decoded.value;

        // Adapter: map wire protocol to internal events.
        if (msg.type === "REGISTERED") {
          peerId = msg.to ?? null;
          registeredPayload = msg.payload;
          if (peerId) {
            const iceServers =
              registeredPayload?.id === "iceServers"
                ? (registeredPayload.data as RTCIceServer[])
                : [];
            emitter.emit("registered", { peerId, iceServers });
          }
        }

        if (msg.type === "RELAY" && msg.payload?.id) {
          const relay = msg.payload;
          emitter.emit("signal", {
            from: msg.from ?? "",
            to: msg.to ?? "",
            type: relay.id as SignalType,
            payload: relay.data as RTCSessionDescriptionInit | RTCIceCandidateInit,
          });
        }
      });
    });

  const register = () =>
    new Promise<{ peerId: string; iceServers: RTCIceServer[] }>((resolve, reject) => {
      if (!ws || !ready) {
        reject(new Error("not connected"));
        return;
      }
      const msg: WireMessage = { type: "REGISTER" };
      ws.send(encode(msg));
      const onRegistered = (payload: { peerId: string; iceServers: RTCIceServer[] }) => {
        emitter.off("registered", onRegistered);
        resolve(payload);
      };
      emitter.on("registered", onRegistered);
    });

  const relay = (message: SignalMessage) => {
    if (!ws || !ready) {
      return;
    }
    // Adapter: internal signal -> wire protocol payload.
    const payload = { id: message.type, data: message.payload };
    const msg: WireMessage = {
      type: "RELAY",
      from: peerId ?? message.from,
      to: message.to,
      payload,
    };
    ws.send(encode(msg));
  };

  const on = emitter.on.bind(emitter) as SignalingClient["on"];
  const off = emitter.off.bind(emitter) as SignalingClient["off"];
  const state = () => ({ peerId, ready });

  return { connect, register, relay, on, off, state };
};
