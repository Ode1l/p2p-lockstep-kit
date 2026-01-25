# Playground Debug Guide (Signaling + WebRTC)

This guide focuses on the new signaling-based demo:
- `playground/signaling-server`
- `playground/playground-webrtc-kit`

## 1) Start the signaling server

From the repo root (`p2p-lockstep-kit`):

```bash
pnpm --filter signaling-server install
pnpm --filter signaling-server dev
```

Expected log:
- `[signaling-server] listening on ws://localhost:8787`

## 2) Start the signaling-based WebRTC demo

From the repo root (`p2p-lockstep-kit`):

```bash
pnpm --filter playground-webrtc-kit install
pnpm --filter playground-webrtc-kit dev
```

Open the dev URL shown by Vite (often `http://localhost:5173/`).

## 3) Test with two tabs

Open two tabs/windows on the same page.

Tab A:
- Peer ID: `peer-a`
- Target Peer ID: `peer-b`

Tab B:
- Peer ID: `peer-b`
- Target Peer ID: `peer-a`

In both tabs:
1) Click `Connect WS`
2) Click `Connect P2P`

## 4) Where to view logs

- Network/signaling details: browser DevTools Console
- UI log panel: user-facing events (send/receive/open/close/error)
- Server logs: the terminal running `signaling-server`

## 5) Manual debug from DevTools Console

The demo exposes a debug helper on `window.debugRTC`.

Examples:

```js
debugRTC.connectSignaling()
debugRTC.connectPeer()
debugRTC.send("hello")
debugRTC.state()
debugRTC.resetPeer()
```

## Notes

- The signaling server is minimal and does not use rooms yet.
- The initiator is chosen by lexicographic peerId order (`peer-a` < `peer-b`).

