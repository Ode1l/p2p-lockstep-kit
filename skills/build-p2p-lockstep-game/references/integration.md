# Runtime Integration

## Install

Resolve the current registry version instead of copying a stale version number:

```bash
pnpm add p2p-lockstep-kit-ui
```

UI composes Network and Session and re-exports public game types. A standard game
app must not create a second Network client or Session.

## HTML shell

```html
<p2p-lockstep-app
  class="block min-h-svh"
  game-title="My Game"
  session-id="my-game"
></p2p-lockstep-app>
<script type="module" src="/src/main.ts"></script>
```

The default theme is light. Players select Day or Night from the built-in menu.
Set `theme="dark"` only when the product should initially open dark. Override
`signal-url` only when using another signaling endpoint.

## Bootstrap

```ts
import "./style.css";
import "p2p-lockstep-kit-ui";
import "p2p-lockstep-kit-ui/style.css";
import type { P2PLockstepAppElement } from "p2p-lockstep-kit-ui";

await customElements.whenDefined("p2p-lockstep-app");
const app = document.querySelector<P2PLockstepAppElement>("p2p-lockstep-app");
const runtime = app?.getRuntime();
const boardHost = app?.getBoardHost();
if (!runtime || !boardHost) throw new Error("Unable to initialize game shell.");

runtime.setGamePlugin(createGamePlugin());
const disposeBoard = mountGameBoard(boardHost, runtime);
import.meta.hot?.dispose(disposeBoard);
```

Do not implement app-owned page routing or reload reconnect workarounds unless the
installed UI demonstrably lacks the behavior. Current UI owns screen routing and
exposes `resumeConnection()` for page-resume recovery.

## Runtime contract

```ts
runtime.setGamePlugin(plugin);
runtime.actions.move(move);
runtime.observer.getSnapshot();
const unsubscribe = runtime.observer.subscribe({
  onStateChange(snapshot) {},
  onConnectionChange(connected) {},
  onGameEvent(event) {},
  onError(error) {},
});
```

Ready, Start, undo, restart, approve, and reject belong to generic UI controls.
Unsubscribe observers and remove board listeners during HMR or unmount.
