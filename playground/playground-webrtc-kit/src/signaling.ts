import { createEmitter } from "../../../src/utils/emitter";

export type SignalingState = "idle" | "connecting" | "open" | "closed" | "error";

export type SignalType = "OFFER" | "ANSWER" | "ICE" | "PING";

export type SignalMessage = {
  type: string;
  from?: string;
  to?: string;
  payload?: unknown;
  error?: { code: string; msg: string };
  ts?: number;
};

export type SignalingEvents = {
  state: { state: SignalingState };
  peers: { peers: string[] };
  offer: { from: string; payload: RTCSessionDescriptionInit };
  answer: { from: string; payload: RTCSessionDescriptionInit };
  ice: { from: string; payload: RTCIceCandidateInit };
  error: { error: unknown };
  log: { message: string };
};

export type SignalingClient = {
  readonly state: SignalingState;
  readonly peerId: string;
  readonly peers: string[];
  on: ReturnType<typeof createEmitter<SignalingEvents>>["on"];
  off: ReturnType<typeof createEmitter<SignalingEvents>>["off"];
  send: (type: SignalType, to: string, payload: unknown) => void;
  close: () => void;
};

export const createSignalingClient = (
  url: string,
  peerId: string,
  logger?: (message: string) => void,
): SignalingClient => {
  const emitter = createEmitter<SignalingEvents>();
  const ws = new WebSocket(url);
  let state: SignalingState = "connecting";
  let peers: string[] = [];

  const emitLog = (message: string) => {
    const full = `[signaling:${peerId}] ${message}`;
    logger?.(full);
    emitter.emit("log", { message: full });
  };

  const setState = (next: SignalingState) => {
    state = next;
    emitter.emit("state", { state: next });
    emitLog(`state=${next}`);
  };

  ws.addEventListener("open", () => {
    setState("open");
    ws.send(JSON.stringify({ type: "HELLO", from: peerId }));
    emitLog("HELLO sent");
  });

  ws.addEventListener("close", () => {
    setState("closed");
  });

  ws.addEventListener("error", (event) => {
    setState("error");
    emitter.emit("error", { error: event });
  });

  ws.addEventListener("message", (event) => {
    let msg: SignalMessage;
    try {
      msg = JSON.parse(String(event.data));
    } catch (err) {
      emitter.emit("error", { error: err });
      emitLog("bad JSON from server");
      return;
    }

    if (msg.error) {
      emitLog(`error:${msg.error.code}`);
      emitter.emit("error", { error: msg.error });
      return;
    }

    if (msg.type === "PEERS") {
      const payload = (msg.payload ?? {}) as { peers?: unknown };
      peers = Array.isArray(payload.peers) ? (payload.peers as string[]) : [];
      emitter.emit("peers", { peers });
      emitLog(`peers=${peers.join(",")}`);
      return;
    }

    if (!msg.from) {
      emitLog(`ignored message without from: ${msg.type}`);
      return;
    }

    if (msg.type === "OFFER") {
      emitter.emit("offer", {
        from: msg.from,
        payload: msg.payload as RTCSessionDescriptionInit,
      });
      emitLog(`offer from ${msg.from}`);
      return;
    }
    if (msg.type === "ANSWER") {
      emitter.emit("answer", {
        from: msg.from,
        payload: msg.payload as RTCSessionDescriptionInit,
      });
      emitLog(`answer from ${msg.from}`);
      return;
    }
    if (msg.type === "ICE") {
      emitter.emit("ice", {
        from: msg.from,
        payload: msg.payload as RTCIceCandidateInit,
      });
      return;
    }
  });

  return {
    get state() {
      return state;
    },
    get peerId() {
      return peerId;
    },
    get peers() {
      return peers;
    },
    on: emitter.on,
    off: emitter.off,
    send(type, to, payload) {
      if (ws.readyState !== ws.OPEN) {
        emitLog(`send blocked: wsState=${ws.readyState}`);
        return;
      }
      ws.send(
        JSON.stringify({
          type,
          from: peerId,
          to,
          payload,
        }),
      );
      emitLog(`${type} -> ${to}`);
    },
    close() {
      ws.close();
    },
  };
};
