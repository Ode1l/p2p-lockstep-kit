import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "p2p-lockstep-kit-network": fileURLToPath(
        new URL("./src/network/index.ts", import.meta.url),
      ),
      "p2p-lockstep-kit-session": fileURLToPath(
        new URL("./src/session/index.ts", import.meta.url),
      ),
      "p2p-lockstep-kit-ui": fileURLToPath(
        new URL("./src/ui/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: "0.0.0.0",
  },
  preview: {
    host: "0.0.0.0",
  },
  build: {
    sourcemap: true,
  },
});
