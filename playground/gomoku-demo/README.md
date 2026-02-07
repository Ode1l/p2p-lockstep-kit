# Gomoku Demo Design Notes (playground/gomoku-demo)

Goal: build a minimal but complete turn-based Gomoku (五子棋) demo on top of
the p2p-lockstep-kit stack. This doc captures the gameplay rules, UI, data
model, message shapes, and flow so we can implement with clarity.

---

## 1. Scope

### 1.1 In Scope (MVP)
- Two-player, 15x15 board, first to 5 in a row wins.
- P2P connection via signaling-server + WebRTC DataChannel.
- Lockstep turn flow: only current player can send a move.
- Basic desync detection with stateHash, and snapshot sync.
- Simple UI: connect, show peer id, input peer id, play board.
- Ready/Rematch flow: both players must click Ready; game ends → both Ready again; black/white swaps each new game.
- Random color assignment for the first game; alternating colors for subsequent games.
- Undo (悔棋) support: one-step rollback if both peers agree (see control flow).
- Basic reconnect support (session resume via SYNC after link drop).

### 1.2 Out of Scope (for now)
- Ranked matchmaking / rooms / lobby list.
- Spectators.
- Advanced rule variants (Renju, forbidden moves).
- Chat, emotes, audio.

---

## 2. Gameplay Rules

- Board: 15x15.
- Players: Black (first) and White.
- Turn order: Black starts, then alternates.
- Win condition: 5 consecutive stones (horizontal/vertical/diagonal).
- Draw: board full with no winner.

---

## 3. UI/UX

### 3.1 Screens
- Connect panel:
  - "Register" (connect to signaling, get my peerId).
  - Show my peerId.
  - Input "peerId to connect".
  - "Connect" button.
- Game panel:
  - Board canvas (15x15).
  - Status bar (my color, current turn, connection state).
  - "Disconnect" button.
  - Small log area (optional).

### 3.2 UX Notes
- Disable board input when not connected or not my turn.
- On hover, show ghost stone on valid empty cell.
- On game end, freeze board and show result.
- On reconnect, show "syncing..." until state is ready.

--- 

## 4. Data Model

### 4.1 Board State
```ts
type Cell = 0 | 1 | 2; // 0 empty, 1 black, 2 white
type Board = Cell[][]; // 15x15

interface GameState {
  board: Board;
  turn: number; // starts at 1
  currentPlayer: 1 | 2; // 1 black, 2 white
  winner: 0 | 1 | 2; // 0 none
  lastMove?: { x: number; y: number };
}
```

### 4.2 Hash
- Hash can be a simple deterministic string (e.g. JSON + rolling hash).
- Suggested: `hash = fnv1a(serialize(board) + turn + currentPlayer)`.

---

## 5. Message Design (DataChannel)

Use the game protocol envelope (see top-level README).

### 5.1 MOVE payloads
```json
{
  "type": "MOVE",
  "sid": "gomoku-demo",
  "from": "peerId",
  "seq": 12,
  "turn": 5,
  "payload": {
    "x": 7,
    "y": 8,
    "player": 1,
    "hashAfter": "hash-after-apply"
  }
}
```

### 5.2 SYNC_REQUEST
```json
{
  "type": "SYNC_REQUEST",
  "sid": "gomoku-demo",
  "from": "peerId",
  "seq": 18,
  "turn": 5,
  "payload": {}
}
```

### 5.3 SYNC_STATE
```json
{
  "type": "SYNC_STATE",
  "sid": "gomoku-demo",
  "from": "peerId",
  "seq": 19,
  "turn": 5,
  "payload": {
    "state": { "board": [], "turn": 5, "currentPlayer": 1, "winner": 0 },
    "stateHash": "hash"
  }
}
```

### 5.4 Control / Meta messages
- READY: player is ready to start/continue.
- START: server-less start signal once both ready (initiator sends).
- UNDO_REQUEST / UNDO_ACCEPT / UNDO_REJECT: coordinate one-step rollback.
- RESULT: announce winner/draw.
- MOVE / MOVE_REJECT: lockstep move + rejection (hash/turn used for strict check).

---

## 6. Turn Flow

1. Local player clicks a cell (x, y).
2. Validate: connected + my turn + cell empty + game not ended.
3. Apply move locally, update hash.
4. Send MOVE (includes hashAfter).
5. Remote validates; if invalid, sends MOVE_REJECT.
6. Remote applies and compares hashAfter; if mismatch, sends MOVE_REJECT and rolls back.
7. Sender receives MOVE_REJECT and rolls back its last move.

Notes:
- Only the current player should send a move.
- If a move arrives for the wrong turn or occupied cell, raise desync.
 - If rollback is not possible (turn gap > 1), request SYNC_STATE.

--- 

## 7. Desync & Recovery

- If hash mismatch on received MOVE:
  - Reject the move and rollback locally.
  - Sender rolls back; if rollback not possible, send SYNC_REQUEST.
- On SYNC_STATE:
  - Replace local state with payload state.
  - Recompute hash and continue.

--- 

## 8. Connection Flow

1. Register with signaling server -> receive peerId + iceServers.
2. Input peerId to connect.
3. WebRTC negotiation via RELAY.
4. DataChannel open -> start game.

Role assignment:
- The "caller" (the peer who initiates connect) is Black by default.
- The other peer is White.
- Ensure both sides agree in the initial handshake:
  - Roles are confirmed via START payload (blackIsCaller).

--- 

## 9. Architecture Layers

### 9.1 Bitmap Layer (bitboard utilities)
- Storage: `Uint32Array(WORDS)` multi-bucket (225 cells → 8 words).
- Helpers: `set(player,x,y)`, `has(player,x,y)`, `isEmpty(x,y)`, `clear(x,y)`, `reset()`, `copy()`.
- Hash: serialize buckets to string/bytes → FNV1a/XXHash for stateHash.
- Optional masks: precompute row/col/diag masks if later needed for AI.

### 9.2 Board Layer (game state)
- Holds `blackBB`, `whiteBB`, `turn`, `currentPlayer`, `winner`, `lastMove`.
- Operations: `place(x,y,player)`, `isWin(lastMove)`, `undo()` (one-step rollback via lastMove snapshot).
- `isWin` uses last-move 4-direction scan (no cross-bucket complexity).

### 9.3 Control Layer (match flow)
- Ready gate: both peers send READY → initiator sends START with assigned colors.
- Color policy: game #1 random (initiator flips coin and sends), game #n alternates.
- Undo: sender issues UNDO_REQUEST; peer replies ACCEPT/REJECT. On accept, both run `undo()` once and adjust turn/currentPlayer.
- Rematch (no reconnect): after RESULT, both must READY again; reuse existing DC and reset game state to initial.
- Reconnect handshake: REJOIN -> re-offer/answer -> SYNC_REQUEST/STATE to realign.
- Reconnect decision (same match): if both detect they have the same cached board (strict hash/turn match),
  they can choose either:
  - RESTART: both READY → START → reset state and begin a fresh game; or
  - RESTORE: send SYNC_REQUEST/STATE to resume the cached board/turn/winner state.
  - Note: no identity check; only cached board hash/turn must match.
 - Reconnect window: expose `resumeTTLms` (or similar) as a configurable input. If the last match is older than
   this window, force RESTART.

#### Reconnect Decision Flow (RESTART vs RESTORE)
```
A reconnects -> registers -> connects -> DC open
A -> B: REJOIN { cacheHash, turn }
B compares cacheHash/turn with its cached state (strict match)
IF match:
  B -> A: REJOIN_OK { canRestore: true }
  A shows choice to user:
    - RESTART: A -> B READY, B -> A READY, A -> B START (reset state)
    - RESTORE: A -> B SYNC_REQUEST, B -> A SYNC_STATE (apply cached board)
ELSE:
  B -> A: REJOIN_OK { canRestore: false } (fresh pairing)
```

#### Move Agreement (Lockstep + Hash)
```
A clicks -> A validates locally -> A applies
A -> B: MOVE { x, y, player, turn, hashAfter }
B validates:
  - If invalid: B -> A MOVE_REJECT { reason, turnB, hashB }
  - If valid:   B applies; compare hashAfter
    - If mismatch: rollback + MOVE_REJECT
    - If match: no reply
Sender on MOVE_REJECT:
  - Roll back one step
  - If rollback not possible, request SYNC_STATE
```

### 9.4 Net Facade
- Wraps p2p-lockstep-kit `register/connect/send/disconnect` + event handlers.
- Outgoing messages: MOVE/MOVE_REJECT, SYNC_REQUEST/STATE, control messages (READY/START/UNDO/RESULT).

---

## 10. Implementation Plan (MVP)

1. Build basic UI with board render and input.
2. Implement local game logic (apply move, win check, hash).
3. Wire to p2p-lockstep-kit:
   - register/connect/send/disconnect
   - listen to data channel messages
4. Implement control messages: READY/START, RESULT, UNDO_REQUEST/ACCEPT/REJECT.
5. Implement reconnect path: REJOIN via signaling, rebuild DC, then SYNC_REQUEST/STATE to resync turn/hash.
6. Implement MOVE/MOVE_REJECT + SYNC_REQUEST/STATE handling.
7. Add minimal logging + status UI.

---

## 11. Directory Sketch

```
playground/gomoku-demo/
  index.html
  src/
    main.ts
    ui/
      board.ts
      panel.ts
    game/
      state.ts
      rules.ts
      hash.ts
    net/
      client.ts
      protocol.ts
    control/
      ready.ts
      undo.ts
      match.ts
```

---

## 12. Open Questions

- Do we need a "ready" step before game start?
- Should we allow rematch without re-connecting? (Yes: reuse existing DC; READY → START → reset state)
- How to persist/restore game for demo?
