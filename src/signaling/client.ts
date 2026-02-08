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
  register: () => Promise<{ peerId: string; iceServers: RTCIceServer[]; resumeToken: string }>;
  resume: (session: {
    peerId: string;
    resumeToken: string;
  }) => Promise<{ peerId: string; iceServers: RTCIceServer[]; resumeToken: string }>;
  relay: (message: SignalMessage) => void;
  on: (event: "signal", handler: (message: SignalMessage) => void) => void;
  off: (event: "signal", handler: (message: SignalMessage) => void) => void;
  state: () => { peerId: string | null; ready: boolean };
};

type SignalingEvents = {
  signal: SignalMessage;
  registered: { peerId: string; iceServers: RTCIceServer[]; resumeToken: string };
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
        if (msg.type === "ERROR") {
          emitter.emit("error", msg);
          return;
        }

        if (msg.type === "REGISTERED" || msg.type === "RESUMED") {
          peerId = msg.to ?? null;
          registeredPayload = msg.payload;
          if (peerId) {
            let iceServers: RTCIceServer[] = [];
            let resumeToken = "";
            if (registeredPayload?.id === "iceServers") {
              iceServers = registeredPayload.data as RTCIceServer[];
            }
            if (registeredPayload?.id === "session") {
              const data = registeredPayload.data as {
                iceServers?: RTCIceServer[];
                resumeToken?: string;
              };
              iceServers = data.iceServers ?? [];
              resumeToken = data.resumeToken ?? "";
            }
            emitter.emit("registered", { peerId, iceServers, resumeToken });
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
    new Promise<{ peerId: string; iceServers: RTCIceServer[]; resumeToken: string }>(
      (resolve, reject) => {
      if (!ws || !ready) {
        reject(new Error("not connected"));
        return;
      }
      const msg: WireMessage = { type: "REGISTER" };
      const onRegistered = (payload: {
        peerId: string;
        iceServers: RTCIceServer[];
        resumeToken: string;
      }) => {
        emitter.off("registered", onRegistered);
        emitter.off("error", onError);
        resolve(payload);
      };
      const onError = (error: unknown) => {
        emitter.off("registered", onRegistered);
        emitter.off("error", onError);
        reject(error instanceof Error ? error : new Error("signaling error"));
      };
      emitter.on("registered", onRegistered);
      emitter.on("error", onError);
      ws.send(encode(msg));
    },
  );

  const resume = (session: { peerId: string; resumeToken: string }) =>
    new Promise<{ peerId: string; iceServers: RTCIceServer[]; resumeToken: string }>(
      (resolve, reject) => {
        if (!ws || !ready) {
          reject(new Error("not connected"));
          return;
        }
        const payload = { id: "resume", data: session };
        const msg: WireMessage = { type: "RESUME", payload };
        const onRegistered = (payload: {
          peerId: string;
          iceServers: RTCIceServer[];
          resumeToken: string;
        }) => {
          emitter.off("registered", onRegistered);
          emitter.off("error", onError);
          resolve(payload);
        };
        const onError = (error: unknown) => {
          emitter.off("registered", onRegistered);
          emitter.off("error", onError);
          reject(error instanceof Error ? error : new Error("resume failed"));
        };
        emitter.on("registered", onRegistered);
        emitter.on("error", onError);
        ws.send(encode(msg));
      },
    );

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

  return { connect, register, resume, relay, on, off, state };
};
