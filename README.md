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
Purpose: register + relay only. Keep it minimal.

Common envelope (type + from/to + payload):
```json
{
  "type": "REGISTER",
  "from": "peerId",
  "to": "peerId?",
  "payload": { "id": "", "data": "" }
}
```

Core message types (minimal set):
- REGISTER (client -> server)
- REGISTERED (server -> client, returns generated peerId)
- RELAY (client -> server -> peer, payload is forwarded as-is)
- ERROR (server -> client, error info in payload)

Notes:
- Server only stores online peers and forwards RELAY messages.
- If `to` is not online, server responds with ERROR (payload contains error info).

Connection flow (two peers):

```
Client A            Signaling Server             Client B
   |                       |                       |
   |--- WS connect ------->|<------ WS connect ----|
   |--- REGISTER --------->|                       |
   |<-- REGISTERED --------|                       |
   |                       |<-------- REGISTER ---|
   |                       |-------- REGISTERED -->|
   |                       |                       |
   |--- RELAY(offer) ----->|---- RELAY(offer) ---->|
   |<-- RELAY(answer) -----|<--- RELAY(answer) ----|
   |--- RELAY(ice) --------|---- RELAY(ice) ------>|
   |<-- RELAY(ice) --------|<--- RELAY(ice) -------|
   |                       |                       |
   |===== DataChannel open (P2P) ==================|
   |<======== Game Protocol messages =============>|
```

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
    /state
    /wire (protocol + serialization)
    /transport
    /signaling
    index.ts (facade: register/connect/send/disconnect)
  /playground
    /playground-webrtc
    /playground-signaling
    /playground-signaling-webrtc
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
- JSON encode/decode helpers (v0.1). ✅
- Message type definitions and validation rules. ✅
- Round-trip examples in playground or simple tests. ✅ (playground-signaling)

### Milestone 2: /src/rendezvous
- WebSocket client for REGISTER/RELAY. ✅
- Simple event emitter for signaling events. ✅
- Basic reconnect strategy (optional for v0.1). ☐

### Milestone 3: /src/transport
- WebRTC DataChannel wrapper (send/receive bytes). ✅
- Connection state mapping (open/close/error). ✅ (basic)

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

---

## ICE Candidates: When They Are Generated

ICE candidates are generated **after you call `setLocalDescription()`**.  
Once the local description is set, the browser automatically starts ICE gathering.
Every time a new candidate is found, the browser fires an `icecandidate` event.
This is why the event seems to happen “automatically”: the ICE agent runs in the background
as part of WebRTC’s connection setup.

---

## Perfect Negotiation (MDN Summary)

MDN’s “perfect negotiation” pattern exists to safely handle offer/answer collisions.
Key ideas:
- **Signal-driven**: you only set descriptions when a signaling message arrives.
- **Role-based**: one side is “polite” (accepts collisions), the other “impolite” (ignores).
- **Collision handling**: if an incoming offer collides with a local offer, the polite peer
  rolls back and accepts the remote offer; the impolite peer ignores it.
- **ICE exchange** runs in parallel and is delivered via the signaling channel.

This keeps renegotiation stable when both peers try to negotiate at the same time.
