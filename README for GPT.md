# p2p-lockstep-kit Design Notes (v0.1, Turn-Based P2P)

Goal: provide a browser-first P2P session and message protocol layer for turn-based games, wrapping WebRTC DataChannel (data plane) and WebSocket (signaling/control plane). Target games: gomoku, chess, mahjong, SanGuoSha, and other turn-based/strategy games.

---

## 1. Scope and Principles

### 1.1 Out of Scope
- NAT traversal logic (ICE/STUN/TURN handled by WebRTC).
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
One-line: Defines a single, versioned message shape shared by all layers.
- Unified message structure and fields.
- Versioning, seq, de-dup, anti-replay.
- Stream multiplexing (control/game/sync/chat).

### 2.3 Controller Layer (Flow Control)
One-line: Pure logic that routes messages, tracks seq, and emits events.
> No browser or network dependencies.
- Envelope creation and parsing.
- Seq tracking and sliding window de-dup.
- Stream routing and event dispatch.
- Light consistency helpers (hash checks -> desync signal).

### 2.4 Transport Layer
One-line: A thin, uniform wrapper around WebRTC DataChannel IO.
- Wrap WebRTC DataChannel into ITransport.
- Connection state mapping + send/receive bytes.

### 2.5 Rendezvous Layer
One-line: Handles peer discovery and WebRTC negotiation via WebSocket.
- WebSocket connect + room management.
- SDP offer/answer and ICE candidate exchange.
- Optional heartbeat/online presence.

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

### 4.2 Envelope (v0.1)
```json
{
  "v": 1,
  "sid": "sessionId",
  "stream": "control|game|sync",
  "t": "MSG_TYPE",
  "seq": 12,
  "from": "peerId",
  "ts": 1730000000000,
  "payload": {}
}
```

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
    index.ts
  /playground
    /playground-webrtc
    /playground-signaling
    /gomoku-demo
  package.json
  tsconfig.json
  tsup.config.ts
  pnpm-workspace.yaml
```

---

## 6. Milestones

### Milestone 0: Playground
- 2 peers create DataChannel
- exchange strings

### Milestone 1: p2p-lockstep-kit v0.1
- Session create/join/start/leave
- 2 peers send/receive Envelope
- seq de-dup works

### Milestone 2: Consistency + Reconnect
- GAME_ACTION + stateHashAfter
- desync -> SYNC_REQUEST/STATE
- reconnect restores consistent state

### Milestone 3: Gomoku Demo
- invite link
- turn-based moves sync
- winner decided by game core
- reconnect restores board

---

## 7. v0.2+ Ideas
- Multi-peer topology (mesh / star)
- DataChannel reliability and backpressure
- Message signing and identity binding
- Richer negotiation (version/capability flags)
- Codec upgrade (msgpack/protobuf)
- Rollback extensions

(end)
