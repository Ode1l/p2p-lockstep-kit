import { fileURLToPath, URL } from "node:url";
import { existsSync } from "node:fs";
import { defineConfig } from "vite";

const localMultisessionEntry = new URL(
  "../p2p-lockstep-kit-multisession/multisession/index.ts",
  import.meta.url,
);

export default defineConfig({
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
  resolve: {
    alias: existsSync(localMultisessionEntry)
      ? {
          "p2p-lockstep-kit-multisession": fileURLToPath(
            localMultisessionEntry,
          ),
        }
      : {},
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "style",
    },
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      external: ["p2p-lockstep-kit-multisession", "qrcode"],
    },
  },
});
