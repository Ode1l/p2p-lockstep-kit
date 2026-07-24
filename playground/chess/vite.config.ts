import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
  build: { sourcemap: true },
});
