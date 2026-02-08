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
  const token = randomUUID();
  peers.set(id, { ws, token, updatedAt: Date.now() });
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
    sendError(ws, msg.type || "ERROR", "BAD_RESUME", "peerId/token required");
    return null;
  }
  const record = peers.get(requestedId);
  if (!record) {
    sendError(ws, msg.type || "ERROR", "SESSION_NOT_FOUND", "Unknown peerId");
    return null;
  }
  if (Date.now() - record.updatedAt > RESUME_TTL_MS) {
    peers.delete(requestedId);
    sendError(ws, msg.type || "ERROR", "SESSION_EXPIRED", "Session expired");
    return null;
  }
  if (record.token !== resumeToken) {
    sendError(ws, msg.type || "ERROR", "BAD_TOKEN", "Invalid resume token");
    return null;
  }
  if (record.ws && isOpen(record.ws)) {
    sendError(ws, msg.type || "ERROR", "ALREADY_CONNECTED", "Peer is online");
    return null;
  }
  record.ws = ws;
  record.updatedAt = Date.now();
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
    sendError(ws, msg.type || "ERROR", "MISSING_TO", "to is required");
    return;
  }

  const target = peers.get(to)?.ws ?? null;
  if (!target || !isOpen(target)) {
    sendError(ws, msg.type, "PEER_OFFLINE", `Peer not connected: ${to}`);
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

    if (msg.type === "RESUME") {
      const id = handleResume(ws, msg);
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
