# Architecture and Ownership

## Package boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Game app | Move schema, deterministic replay, rules, outcomes, board UI, game tests | Signaling, Peer ID lifecycle, generic controls |
| `p2p-lockstep-kit-ui` | Pairing/share UI, app shell, status, controls, theme, board host, runtime, page resume | Game rules, lobby, matchmaking |
| `p2p-lockstep-kit-session` | Two-player FSM, ordered history, approvals, plugin validation, observers, sync | Board pixels, signaling UI |
| `p2p-lockstep-kit-network` | Signaling registration/resume, ICE, WebRTC peer/DataChannel transport | Game state or rule arbitration |

For the standard flow, import UI only. Advanced transport code may use Network's
`NetworkEndpoint` and `PeerLink`, but those do not implement multiplayer
membership or ordering and are unnecessary for a normal 1v1 app.

## Product flow

```text
register/resume local Peer ID
  -> share Peer ID/link/QR
  -> connect to one target
  -> DataChannel opens
  -> Ready / Start
  -> exchange validated deterministic moves
```

There is no public lobby, matchmaking service, or server-owned game state. A
`session-id` scopes protocol messages; it is not a browsable room.

## Screen routing and recovery

Relevant states include `idle`, `ready`, `could_start`, `turn`, `remote_turn`,
`waiting_approval`, `approving`, `syncing`, and `offline`.

Treat `snapshot.connected` as authority for fresh navigation. A target ID in a URL
and network `requesting` mean only that a handshake is in progress. Preserve the
game while an existing match with history reconnects.

Network resume restores Peer ID and signaling identity. Session sync restores
history, starter, and turn through `SYNC_REQUEST`/`SYNC_STATE`. Do not replace it
with game-specific state messages. Mobile browsers can freeze rather than reload;
use the installed UI's page-resume recovery.

## Multiplayer boundary

Current assumptions are one local player, one remote player, binary perspective,
one-to-one approvals, and a two-player timeline. Supporting three or more players
requires separate participant/membership, topology, ordering, private-state, sync,
and UI design; a loop over `PeerLink` is not a multiplayer Session.
