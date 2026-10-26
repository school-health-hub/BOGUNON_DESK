import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "qa-surface",
  plugins: [react()],
  resolve: {
    alias: {
      "/src/surface-qa": fileURLToPath(new URL("./src/surface-qa", import.meta.url)),
    },
  },
  server: { host: "127.0.0.1", port: 1433, strictPort: true },
  preview: { host: "127.0.0.1", port: 1434, strictPort: true },
  build: {
    outDir: "../dist-surface-qa-main",
    emptyOutDir: true,
  },
});
