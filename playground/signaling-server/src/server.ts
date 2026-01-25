import { WebSocket, WebSocketServer } from "ws";

const port = 8787;
const wss = new WebSocketServer({ port });

// Map peerId -> socket for simple directed signaling.
const peers = new Map<string, WebSocket>();
const SIGNAL_TYPES = new Set(["OFFER", "ANSWER", "ICE", "PING"]);

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

const broadcastPeers = () => {
  const list = [...peers.keys()];
  const msg = { type: "PEERS", payload: { peers: list } };
  for (const ws of peers.values()) {
    if (isOpen(ws)) {
      send(ws, msg);
    }
  }
};

wss.on("connection", (ws: WebSocket) => {
  let peerId: string | null = null;

  ws.on('message', (raw) => {
    const msg = parseMessage(raw);
    if (!msg) {
      sendError(ws, 'ERROR', 'BAD_JSON', 'Invalid JSON');
      return;
    }

    if (msg.type === 'HELLO') {
      const id = String(msg.from || '').trim();
      if (!id) {
        sendError(ws, 'HELLO', 'MISSING_ID', 'from is required');
        return;
      }
      const existing = peers.get(id);
      if (existing && existing !== ws && isOpen(existing)) {
        sendError(ws, 'HELLO', 'ID_TAKEN', `peerId already in use: ${id}`);
        return;
      }
      peerId = id;
      peers.set(peerId, ws);
      send(ws, { type: 'HELLO', payload: { peerId } });
      broadcastPeers();
      return;
    }

    if (!peerId) {
      sendError(ws, msg.type || 'ERROR', 'NOT_REGISTERED', 'Send HELLO first');
      return;
    }

    if (!SIGNAL_TYPES.has(msg.type)) {
      sendError(
        ws,
        msg.type || 'ERROR',
        'UNSUPPORTED_TYPE',
        'Unsupported message type',
      );
      return;
    }

    const to = msg.to ? String(msg.to) : '';
    if (!to) {
      sendError(ws, msg.type || 'ERROR', 'MISSING_TO', 'to is required');
      return;
    }

    const target = peers.get(to);
    if (!target || !isOpen(target)) {
      sendError(ws, msg.type, 'PEER_OFFLINE', `Peer not connected: ${to}`);
      return;
    }

    // Forward signaling messages as-is with minimal shaping.
    send(target, {
      type: msg.type,
      from: peerId,
      to,
      payload: msg.payload ?? null,
      ts: Date.now(),
    });
  });

  ws.on("close", () => {
    if (peerId) {
      peers.delete(peerId);
      broadcastPeers();
    }
  });
});

// eslint-disable-next-line no-console
console.log(`[signaling-server] listening on ws://localhost:${port}`);
