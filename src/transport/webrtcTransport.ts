import { createEmitter } from "../utils/emitter";
import type { Emitter } from "../utils/emitter";
import type { ITransport, TransportEvents, TransportState } from "./types";

export type WebRTCTransport = ITransport & {
  on: Emitter<TransportEvents>["on"];
  off: Emitter<TransportEvents>["off"];
};

export type WebRTCTransportOptions = {
  // Optional logger for console/debug output.
  logger?: (message: string) => void;
  // Optional label override for clearer log messages.
  label?: string;
};

const toState = (dc: RTCDataChannel | null): TransportState => {
  if (!dc) {
    return "idle";
  }
  switch (dc.readyState) {
    case "connecting":
      return "connecting";
    case "open":
      return "open";
    case "closing":
      return "closing";
    case "closed":
      return "closed";
    default:
      return "error";
  }
};

export const createWebRTCTransport = (
  channel: RTCDataChannel,
  options: WebRTCTransportOptions = {},
): WebRTCTransport => {
  const emitter = createEmitter<TransportEvents>();
  const label = options.label ?? channel.label ?? "dc";

  const emitLog = (message: string) => {
    const full = `[transport:${label}] ${message}`;
    options.logger?.(full);
    emitter.emit("log", { message: full });
  };

  const emitState = () => {
    const state = toState(channel);
    emitter.emit("state", { state });
    emitLog(`state=${state}`);
  };

  channel.addEventListener("open", () => {
    emitState();
    emitLog("open");
    emitter.emit("open", undefined);
  });

  channel.addEventListener("close", () => {
    emitState();
    emitLog("close");
    emitter.emit("close", {});
  });

  channel.addEventListener("error", (event) => {
    emitState();
    emitLog("error");
    emitter.emit("error", { error: event });
  });

  channel.addEventListener("message", (event) => {
    const data = String(event.data);
    emitLog(`message(len=${data.length})`);
    emitter.emit("message", { data });
  });

  // Emit the initial state so callers can render immediately.
  emitLog("attached");
  emitState();

  return {
    get state() {
      return toState(channel);
    },
    on: emitter.on,
    off: emitter.off,
    send(data: string) {
      if (channel.readyState !== "open") {
        emitLog(`send blocked: state=${channel.readyState}`);
        emitter.emit("error", {
          error: new Error(`DataChannel not open: ${channel.readyState}`),
        });
        return;
      }
      emitLog(`send(len=${data.length})`);
      channel.send(data);
    },
    close(reason?: string) {
      if (reason) {
        emitLog(`close requested: ${reason}`);
        emitter.emit("close", { reason });
      }
      channel.close();
    },
  };
};
