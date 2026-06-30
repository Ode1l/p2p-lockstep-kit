# Application, UI, Testing, and Deployment

## Package shape

Create a private application, not a library:

```json
{
  "name": "my-p2p-game",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "build": "pnpm typecheck && vite build"
  },
  "dependencies": {
    "p2p-lockstep-kit-ui": "<current published range>"
  }
}
```

Resolve current versions from the registry. Commit `package.json` and lockfile
together. A frozen-lockfile specifier error means they differ.

## Vite and Tailwind

```ts
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
  build: { sourcemap: true },
});
```

Use `@import "tailwindcss";`. Do not use `build.lib`; a deployable application
needs an HTML entry.

## Responsive board

- Treat 390px phone and desktop widths as primary.
- Cap a stable board aspect ratio by available width and viewport height.
- Use `100svh` where mobile browser chrome affects height.
- Use pointer events for mouse/touch parity and set `touch-action` deliberately.
- For canvas, map coordinates through canvas pixels / bounding rectangle.
- Use public `--lock-*` theme tokens, not package internals.
- Preserve selection, last move, legal targets, outcome, and accessible labels.

## Browser and deployment verification

Verify meaningful DOM, no relevant console errors, desktop/phone screenshots,
legal and illegal interactions, themes, controls, fresh/stale invites, two peers,
disconnect/reopen, and sync.

Cloudflare Pages for a static app:

```text
Build command: pnpm build
Build output directory: dist
```

Wrangler is not required. Run frozen install, tests, typecheck, and build. Require
`dist/index.html` plus hashed assets. If only JS is emitted, remove library mode.
The UI package itself is a library and may use a separate demo build; do not copy
its deployment settings into a game app.
