import express from "express";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";

import {signalingPort, iceServers} from "../configuration.json";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Map peerId -> socket for simple directed signaling.
const peers = new Map<string, WebSocket>();

const send = (ws: WebSocket, msg: unknown) => {
  ws.send(JSON.stringify(msg));
};

const isOpen = (ws: WebSocket) => ws.readyState === ws.OPEN;

const sendError = (ws: WebSocket, type: string, code: string, msg: string) => {
  send(ws, { type, error: { code, msg } });
};

const parseMessage = (raw: WebSocket.RawData): any | null => {
  try {
    return JSON.parse(String(raw));
  } catch (err) {
    return null;
  }
};

// User events: register
const handleRegister = (ws: WebSocket) => {
  const id = randomUUID();
  peers.set(id, ws);
  send(ws, {
    type: 'REGISTERED',
    to: id,
    payload: {
      id: 'iceServers',
      data : iceServers
    },
    ts: Date.now(),
  });
  return id;
};

// Server events: relay
const handleRelay = (ws: WebSocket, peerId: string, msg: any) => {
  const to = msg.to ? String(msg.to) : "";
  if (!to) {
    sendError(ws, msg.type || "ERROR", "MISSING_TO", "to is required");
    return;
  }

  const target = peers.get(to);
  if (!target || !isOpen(target)) {
    sendError(ws, msg.type, "PEER_OFFLINE", `Peer not connected: ${to}`);
    return;
  }

  send(target, {
    type: "RELAY",
    from: peerId,
    to,
    payload: msg.payload ?? null,
    ts: Date.now(),
  });
};

wss.on("connection", (ws: WebSocket) => {
  let peerId: string | null = null;

  ws.on("message", (raw) => {
    const msg = parseMessage(raw);
    if (!msg) {
      sendError(ws, "ERROR", "BAD_JSON", "Invalid JSON");
      return;
    }

    if (msg.type === "REGISTER") {
      const id = handleRegister(ws);
      if (id) {
        peerId = id;
      }
      return;
    }

    if (!peerId) {
      sendError(ws, msg.type || "ERROR", "NOT_REGISTERED", "Send HELLO first");
      return;
    }

    if (msg.type === "RELAY") {
      handleRelay(ws, peerId, msg);
      return;
    }

    sendError(
      ws,
      msg.type || "ERROR",
      "UNSUPPORTED_TYPE",
      "Unsupported message type",
    );
  });

  ws.on("close", () => {
    if (peerId) {
      peers.delete(peerId);
    }
  });
});

server.listen(signalingPort, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[signaling-server] listening on http://localhost:${signalingPort}`,
  );
});
