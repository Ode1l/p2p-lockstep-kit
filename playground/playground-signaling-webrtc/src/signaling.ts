import { encode, decodeSafe } from "../../../src/serialization";
import type { SignalMessage as WireMessage } from "../../../src/protocol";
import { Emitter } from "./emitter";

export type SignalType = "offer" | "answer" | "ice";

export type SignalMessage = {
  from: string;
  to: string;
  type: SignalType;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

type RegisterResult = {
  peerId: string;
  iceServers: RTCIceServer[];
};

type SignalingEvents = {
  signal: SignalMessage;
  registered: RegisterResult;
  error: unknown;
};

export const createSignalingClient = () => {
  let ws: WebSocket | null = null;
  let peerId: string | null = null;
  let ready = false;
  let registeredPayload: WireMessage["payload"] | undefined;
  const emitter = new Emitter<SignalingEvents>();

  const connect = (url: string) =>
    new Promise<void>((resolve) => {
      ws?.close();
      ws = new WebSocket(url);
      ws.addEventListener("open", () => {
        ready = true;
        registeredPayload = undefined;
        // eslint-disable-next-line no-console
        console.log("[signal] connected");
        resolve();
      });
      ws.addEventListener("close", () => {
        ready = false;
        peerId = null;
        registeredPayload = undefined;
        // eslint-disable-next-line no-console
        console.log("[signal] disconnected");
      });
      ws.addEventListener("message", (event) => {
        const raw = String(event.data);
        const decoded = decodeSafe<WireMessage>(raw);
        if (!decoded.ok) {
          // eslint-disable-next-line no-console
          console.warn("[signal] bad message", decoded.error);
          return;
        }
        const msg = decoded.value;
        // eslint-disable-next-line no-console
        console.log("[signal] <-", msg);

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
    new Promise<RegisterResult>((resolve, reject) => {
      if (!ws || !ready) {
        reject(new Error("not connected"));
        return;
      }
      const msg: WireMessage = { type: "REGISTER" };
      ws.send(encode(msg));

      const onRegistered = (payload: RegisterResult) => {
        emitter.off("registered", onRegistered);
        resolve(payload);
      };
      emitter.on("registered", onRegistered);
    });

  const relay = (message: SignalMessage) => {
    if (!ws || !ready) {
      return;
    }
    const payload = { id: message.type, data: message.payload };
    const msg: WireMessage = {
      type: "RELAY",
      from: peerId ?? message.from,
      to: message.to,
      payload,
    };
    // eslint-disable-next-line no-console
    console.log("[signal] ->", msg);
    ws.send(encode(msg));
  };

  const on = emitter.on.bind(emitter);
  const off = emitter.off.bind(emitter);

  const state = () => ({ peerId, ready });

  return { connect, register, relay, on, off, state };
};
