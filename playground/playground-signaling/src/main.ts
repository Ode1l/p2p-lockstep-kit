import { encode, decodeSafe } from "../../../src/serialization";
import type { SignalMessage } from "../../../src/protocol";
import CONFIG from "../configuration.json";

type Client = {
  connect: (url?: string) => Promise<void>;
  register: () => void;
  relay: (to: string, id: string, data?: unknown) => void;
  state: () => { id: string | null; ready: boolean };
};

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = "playground-signaling (open DevTools console)";
}

const createClient = (): Client => {
  let ws: WebSocket | null = null;
  let id: string | null = null;
  let ready = false;

  const connect = (url?: string) =>
    new Promise<void>((resolve) => {
    ws?.close();
    ws = new WebSocket(url ?? CONFIG.signalingUrl);

    ws.addEventListener("open", () => {
      ready = true;
      // eslint-disable-next-line no-console
      console.log("[signal] connected");
      resolve();
    });

    ws.addEventListener("close", () => {
      ready = false;
      id = null;
      // eslint-disable-next-line no-console
      console.log("[signal] disconnected");
    });

    ws.addEventListener("message", (event) => {
      const raw = String(event.data);
      const decoded = decodeSafe<SignalMessage>(raw);
      if (!decoded.ok) {
        // eslint-disable-next-line no-console
        console.warn("[signal] bad message", decoded.error);
        return;
      }
      const message = decoded.value as SignalMessage & { payload?: any };
      // eslint-disable-next-line no-console
      console.log("[signal] <-", message);

      if (message.type === "REGISTERED") {
        id = message.to ?? null;
        // eslint-disable-next-line no-console
        console.log("[signal] registered id=", id);
        return;
      }

      if (message.type === "ERROR") {
        // eslint-disable-next-line no-console
        console.warn("[signal] error", message.payload);
      }
    });
  });

  const register = async () => {
    if (!ws || !ready) {
      await connect();
    }
    if (!ws || !ready) {
      return;
    }
    const msg: SignalMessage = { type: "REGISTER" };
    ws.send(encode(msg));
    // eslint-disable-next-line no-console
    console.log("[signal] ->", msg);
  };

  const relay = (to: string, id: string, data?: unknown) => {
    if (!ws || !ready) {
      return;
    }
    const wrapped = { id, data: data ?? null };
    const msg: SignalMessage = {
      type: "RELAY",
      from: id ?? undefined,
      to,
      payload: wrapped,
    };
    ws.send(encode(msg));
    // eslint-disable-next-line no-console
    console.log("[signal] ->", msg);
  };

  const state = () => ({ id, ready });

  return { connect, register, relay, state };
};

(window as any).debug = {
  createClient,
};

// Test flow (run in DevTools console):
// const c1 = window.debug.createClient();
// const c2 = window.debug.createClient();
// c1.register();
// c2.register();
// const id1 = c1.state().id;
// const id2 = c2.state().id;
// c1.relay(id2, "offer", { hello: "from c1" }); or c1.relay(id2, "offer",  "hello: from c1" );
// c2.relay(id1, "answer", { hello: "from c2" }); or c2.relay(id1, "answer",  "hello: from c2" );
