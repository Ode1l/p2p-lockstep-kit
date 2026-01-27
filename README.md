# p2p-lockstep-kit Design Notes (v0.1, Turn-Based P2P)

Goal: provide a browser-first P2P session and message protocol layer for turn-based games, wrapping WebRTC DataChannel (data plane) and WebSocket (signaling/control plane). Target games: gomoku, chess, mahjong, Three Kingdom, and other turn-based/strategy games.

---

## 1. Scope and Principles

### 1.1 Out of Scope
- DHT / PubSub / IPFS.
- Game rules or authoritative arbitration.
- Server authority (server is only for control plane/signaling/room coordination).

### 1.2 In Scope
- **Session management**: rooms, members, state machine (lobby/playing/reconnecting/ended).
- **Message protocol**: Envelope, seq, de-dup, anti-replay, stream multiplexing.
- **Connection orchestration**: WebRTC negotiation, state monitoring, auto-reconnect/re-negotiate.
- **Consistency support**: stateHash checks, snapshots, desync detection.
- **Game adapter**: IGameAdapter to isolate game logic from networking.

---

## 2. Layers and Responsibilities

### 2.1 Session Layer
One-line: Orchestrates the room lifecycle and exposes the high-level game API.
- Room lifecycle (create/join/start/leave/end).
- Seats/roles/turn order management.
- Reconnect + recovery (auto SYNC_REQUEST).
- Events and high-level API (sendGameAction, requestSync).

### 2.2 Protocol / Envelope Layer
One-line: Defines message shapes for signaling (server) and game data (peer).
- **Two protocols**: signaling (WebSocket) and game data (DataChannel).
- Signaling focuses on room + SDP/ICE exchange (no game fields).
- Game protocol focuses on turn/seq/stateHash and in-game streams.

### 2.3 Controller Layer (Flow Control)
One-line: Pure logic that routes messages, tracks seq, and emits events.
> No browser or network dependencies.
- Envelope creation and parsing.
- Seq tracking and sliding window de-dup.
- Stream routing and event dispatch.
- Light consistency helpers (hash checks → desync signal).

### 2.4 Transport Layer
One-line: A thin, uniform wrapper around WebRTC DataChannel IO.
- Wrap WebRTC DataChannel into ITransport.
- Connection state mapping + send/receive bytes.

### 2.5 Rendezvous Layer
One-line: Handles peer discovery and WebRTC negotiation via WebSocket.
- WebSocket connect + room management.
- SDP offer/answer and ICE candidate exchange.
- Optional heartbeat/online presence.
- Uses the **signaling protocol**, separate from game data protocol.

### 2.6 Serialization Layer
One-line: Encodes and decodes messages on the wire.
- v0.1 uses JSON.
- Future: msgpack/protobuf.

### 2.7 IGameAdapter (Game Side)
One-line: The game-owned boundary for actions, snapshots, and hashes.
> Implemented by the game; p2p-kit does not know rules.
- onLocalAction(action)
- onRemoteMessage(msg)
- getSnapshot()/applySnapshot(snapshot)
- getStateHash()

---

## 3. Sync Model (Turn-Based First)

### 3.1 Choice
v0.1 defaults to **lockstep**: turn-based actions, only the current player sends action.

### 3.2 Consistency
Each GAME_ACTION includes stateHashAfter; compare locally after apply.

### 3.3 Desync Handling
- On mismatch: SYNC_REQUEST.
- Peer replies with SYNC_STATE snapshot.

### 3.4 When to Consider Rollback
- Real-time, low-latency input feel (fighters/FPS/platformers).
- Turn-based games typically do not need rollback.

---

## 4. Public API (Game Contract)

### 4.1 Session
- createRoom() / joinRoom(invite)
- start() / leave()
- send(stream, type, payload)
- sendGameAction(action)
- requestSync()

Events:
- stateChanged
- peerJoined / peerLeft
- connected / disconnected
- desync

### 4.2 Signaling Protocol (WebSocket, v0.1)
Purpose: rendezvous only (room + SDP/ICE). Keep it minimal.

Common envelope (event + payload, optional error):
```json
{
  "type": "ROOM_JOIN",
  "roomId": "roomId",
  "from": "peerId",
  "to": "peerId?",
  "payload": {},
  "error": { "code": "ROOM_FULL", "msg": "Room is full" }
}
```

Core message types (minimal set):
- ROOM_JOIN (client -> server)
- ROOM_STATE (server → clients, member list + roles)
- OFFER (client -> server -> peer, SDP offer)
- ANSWER (client -> server -> peer, SDP answer)
- ICE (client → server → peer, ICE candidate)

Error handling:
- On failure, respond with the same `type` and an `error` object.
- `error.code` is a short string (e.g. ROOM_FULL, NOT_FOUND, BAD_REQUEST).

Connection flow (game creation, two peers):

```
Client A            Signaling Server             Client B
   |                       |                       |
   |--- WS connect ------->|<------ WS connect ----|
   |                       |                       |
   |--- ROOM_JOIN -------->|                       |
   |                       |<-------- ROOM_JOIN ---|
   |<-- ROOM_STATE --------|-------- ROOM_STATE -->|
   |                       |                       |
   |--- OFFER (SDP) ------>|------- OFFER (SDP) -->|
   |<-- ANSWER (SDP) ------|<------ ANSWER (SDP) --|
   |                       |                       |
   |--- ICE -------------->|-------- ICE --------->|
   |<-- ICE ---------------|<------- ICE ----------|
   |                       |                       |
   |===== DataChannel open (P2P) ==================|
   |<======== Game Protocol messages =============>|
```

DataChannel setup flow (code-level, real signaling via WebSocket):
1) Both peers connect to the signaling server (WebSocket) and join the same room.
2) Both peers create `RTCPeerConnection(iceConfig)`.
3) Peer A creates the channel: `dcA = pcA.createDataChannel("game", dataChannelConfig)`.
4) Peer B listens: `pcB.ondatachannel = (e) => { dcB = e.channel; }`.
5) Peer A gathers ICE and forwards candidates through signaling:
   - `pcA.onicecandidate = (e) => ws.send({ type: "ICE", to: "B", payload: e.candidate })`
6) Peer B does the same:
   - `pcB.onicecandidate = (e) => ws.send({ type: "ICE", to: "A", payload: e.candidate })`
7) Peer A starts offer/answer and sends the offer through signaling:
   - `offer = await pcA.createOffer()`
   - `await pcA.setLocalDescription(offer)`
   - `ws.send({ type: "OFFER", to: "B", payload: offer })`
8) Peer B receives the offer via signaling and answers:
   - `await pcB.setRemoteDescription(offer)`
   - `answer = await pcB.createAnswer()`
   - `await pcB.setLocalDescription(answer)`
   - `ws.send({ type: "ANSWER", to: "A", payload: answer })`
9) Peer A receives the answer via signaling and finalizes:
   - `await pcA.setRemoteDescription(answer)`
10) On signaling messages:
   - `OFFER` -> `pc.setRemoteDescription(offer)`
   - `ANSWER` -> `pc.setRemoteDescription(answer)`
   - `ICE` -> `pc.addIceCandidate(candidate)`
11) Use `dc.onopen` as the "ready" signal, then send game messages.

### 4.3 Game Protocol (DataChannel, v0.1)
Purpose: in-game control + sync. Keep it minimal.

Common envelope:
```json
{
  "type": "GAME_ACTION",
  "sid": "sessionId",
  "from": "peerId",
  "seq": 12,
  "turn": 5,
  "stateHash": "hash?",
  "payload": {}
}
```

Notes:
- `seq` is per-sender monotonic for de-dup and ordering checks.
- `turn` is the global turn counter for lockstep.
- `stateHash` is optional but recommended for desync detection.

Minimal message types:
- GAME_ACTION (send action for the current turn)
- SYNC_REQUEST (ask for snapshot)
- SYNC_STATE (send snapshot)

---

## 4.4 Minimal Requirements Analysis

Goal: determine the smallest feature set needed for a turn-based P2P game, and what WebSocket/WebRTC already provide.

Minimum features you must build (application layer):
- **Room coordination**: who is in the room, roles/seats, and when the game can start.
- **Signaling messages**: exchange SDP/ICE via the server to establish the P2P link.
- **Game message protocol**: define action types and payloads (game rules are outside the kit).
- **Turn/sequence logic**: validate actions by turn and drop duplicates.
- **State sync fallback**: request/receive snapshots when a desync is detected or on reconnect.

Provided by WebSocket (you do NOT build these):
- **Server connection**: persistent client-server channel.
- **Message delivery to server**: ordered, reliable transport between client and server.
- **Backpressure**: socket buffering and readyState checks.

Provided by WebRTC DataChannel (you do NOT build these):
- **P2P data transport**: direct client-to-client channel after negotiation.
- **Reliability & ordering**: if you use default settings (reliable + ordered).
- **NAT traversal**: ICE/STUN/TURN mechanisms handled by WebRTC stack.

Not provided by WebSocket/WebRTC (you must build or decide):
- **Room logic**: join rules, max players, roles, permissions.
- **Protocol semantics**: message types, fields, validation rules.
- **Game consistency**: turn tracking, state hashing, snapshot sync policy.
- **Security policy**: auth, anti-abuse, rate limits, optional signing.
---

## 5. Repository Structure (Suggested)

```
/ts-p2p-lockstep-kit
  /src
    /controller
    /session
    /transport
    /rendezvous
    /serialization
    /protocol
    index.ts
  /playground
    /playground-webrtc
    /playground-signaling
    /gomoku-demo
  package.json
  tsconfig.json
  tsup.configuration.ts
  pnpm-workspace.yaml
```

---

## 6. Milestones

### Milestone 0: Protocol Design (README first)
- Signaling protocol: message types, minimal fields, error format.
- Game protocol: envelope fields, message types, turn/seq rules.
- Connection flow diagram and responsibilities by layer.

### Milestone 1: /src/serialization + /src/protocol
- JSON encode/decode helpers (v0.1).
- Message type definitions and validation rules.
- Round-trip examples in playground or simple tests.

### Milestone 2: /src/rendezvous
- WebSocket client for ROOM_JOIN/ROOM_STATE/OFFER/ANSWER/ICE.
- Simple event emitter for signaling events.
- Basic reconnect strategy (optional for v0.1).

### Milestone 3: /src/transport
- WebRTC DataChannel wrapper (send/receive bytes).
- Connection state mapping (open/close/error).

### Milestone 4: /src/controller
- seq de-dup and turn validation.
- Stream routing (control/game/sync).
- SYNC_REQUEST / SYNC_STATE helpers.

### Milestone 5: /src/session
- High-level API: create/join/start/leave.
- Glue rendezvous + transport + controller.
- Room state machine (lobby/playing/reconnecting/ended).

### Milestone 6: /playground demos
- signaling playground: room join + SDP/ICE exchange.
- WebRTC playground: DataChannel send/receive.
- gomoku demo: lockstep turns + sync restore.

---

## 7. v0.2+ Ideas
- Multi-peer topology (mesh / star)
- DataChannel reliability and backpressure
- Message signing and identity binding
- Richer negotiation (version/capability flags)
- Codec upgrade (msgpack/protobuf)
- Rollback extensions

(end)
