import express from "express";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";

import { signalingHost, signalingPort, iceServers } from "../configuration.json";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Resume TTL is sliding:
// - active connections are never purged
// - disconnected sessions expire RESUME_TTL_MS after last activity/close
const RESUME_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

type PeerRecord = {
  ws: WebSocket | null;
  token: string;
  updatedAt: number;
};

// Map peerId -> session record for simple directed signaling.
const peers = new Map<string, PeerRecord>();

const send = (ws: WebSocket, msg: unknown) => {
  ws.send(JSON.stringify(msg));
};

const isOpen = (ws: WebSocket) => ws.readyState === ws.OPEN;

const sendError = (ws: WebSocket, code: string, msg: string) => {
  send(ws, { type: "ERROR", error: { code, msg } });
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
  const token = randomUUID();
  peers.set(id, { ws, token, updatedAt: Date.now() });
  // eslint-disable-next-line no-console
  console.log("[signaling-server] REGISTER", { id });
  send(ws, {
    type: "REGISTERED",
    to: id,
    payload: {
      id: "session",
      data: { iceServers, resumeToken: token },
    },
    ts: Date.now(),
  });
  return id;
};

const handleResume = (ws: WebSocket, msg: any) => {
  const data = msg?.payload?.data as { peerId?: string; resumeToken?: string } | undefined;
  const requestedId = data?.peerId ? String(data.peerId) : "";
  const resumeToken = data?.resumeToken ? String(data.resumeToken) : "";
  if (!requestedId || !resumeToken) {
    // eslint-disable-next-line no-console
    console.log("[signaling-server] RESUME missing fields");
    sendError(ws, "BAD_RESUME", "peerId/token required");
    return null;
  }
  const record = peers.get(requestedId);
  if (!record) {
    // eslint-disable-next-line no-console
    console.log("[signaling-server] RESUME unknown peer", requestedId);
    sendError(ws, "SESSION_NOT_FOUND", "Unknown peerId");
    return null;
  }
  if (Date.now() - record.updatedAt > RESUME_TTL_MS) {
    // eslint-disable-next-line no-console
    console.log("[signaling-server] RESUME expired", requestedId);
    peers.delete(requestedId);
    sendError(ws, "SESSION_EXPIRED", "Session expired");
    return null;
  }
  if (record.token !== resumeToken) {
    // eslint-disable-next-line no-console
    console.log("[signaling-server] RESUME bad token", requestedId);
    sendError(ws, "BAD_TOKEN", "Invalid resume token");
    return null;
  }
  if (record.ws && isOpen(record.ws)) {
    // eslint-disable-next-line no-console
    console.log("[signaling-server] RESUME already connected", requestedId);
    sendError(ws, "ALREADY_CONNECTED", "Peer is online");
    return null;
  }
  record.ws = ws;
  record.updatedAt = Date.now();
  // eslint-disable-next-line no-console
  console.log("[signaling-server] RESUME ok", requestedId);
  send(ws, {
    type: "RESUMED",
    to: requestedId,
    payload: {
      id: "session",
      data: { iceServers, resumeToken: record.token },
    },
    ts: Date.now(),
  });
  return requestedId;
};

// Server events: relay
const handleRelay = (ws: WebSocket, peerId: string, msg: any) => {
  const to = msg.to ? String(msg.to) : "";
  if (!to) {
    // eslint-disable-next-line no-console
    console.log("[signaling-server] RELAY missing to", peerId);
    sendError(ws, "MISSING_TO", "to is required");
    return;
  }

  const target = peers.get(to)?.ws ?? null;
  if (!target || !isOpen(target)) {
    // eslint-disable-next-line no-console
    console.log("[signaling-server] RELAY offline", { from: peerId, to });
    sendError(ws, "PEER_OFFLINE", `Peer not connected: ${to}`);
    return;
  }

  const senderRecord = peers.get(peerId);
  if (senderRecord) {
    senderRecord.updatedAt = Date.now();
  }

  send(target, {
    type: "RELAY",
    from: peerId,
    to,
    payload: msg.payload ?? null,
    ts: Date.now(),
  });
  // eslint-disable-next-line no-console
  console.log("[signaling-server] RELAY", { from: peerId, to });
};

wss.on("connection", (ws: WebSocket) => {
  let peerId: string | null = null;
  // eslint-disable-next-line no-console
  console.log("[signaling-server] WS connected");

  ws.on("message", (raw) => {
    const msg = parseMessage(raw);
    if (!msg) {
      // eslint-disable-next-line no-console
      console.log("[signaling-server] BAD_JSON");
      sendError(ws, "BAD_JSON", "Invalid JSON");
      return;
    }

    if (msg.type === "REGISTER") {
      const id = handleRegister(ws);
      if (id) {
        peerId = id;
      }
      return;
    }

    if (msg.type === "RESUME") {
      const id = handleResume(ws, msg);
      if (id) {
        peerId = id;
      }
      return;
    }

    if (!peerId) {
      // eslint-disable-next-line no-console
      console.log("[signaling-server] NOT_REGISTERED", msg.type);
      sendError(ws, "NOT_REGISTERED", "Register first");
      return;
    }

    if (msg.type === "RELAY") {
      handleRelay(ws, peerId, msg);
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[signaling-server] UNSUPPORTED", msg.type);
    sendError(ws, "UNSUPPORTED_TYPE", "Unsupported message type");
  });

  ws.on("close", () => {
    if (peerId) {
      // eslint-disable-next-line no-console
      console.log("[signaling-server] WS closed", peerId);
      const record = peers.get(peerId);
      if (record) {
        record.ws = null;
        record.updatedAt = Date.now();
      }
    }
  });
});

server.listen(signalingPort, signalingHost, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[signaling-server] listening on http://${signalingHost}:${signalingPort}`,
  );
});

setInterval(() => {
  const now = Date.now();
  for (const [id, record] of peers) {
    if (record.ws && isOpen(record.ws)) {
      continue;
    }
    if (now - record.updatedAt > RESUME_TTL_MS) {
      peers.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);
