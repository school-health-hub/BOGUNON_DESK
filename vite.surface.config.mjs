import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { surfaceIsolation } from "./scripts/surface-isolation.mjs";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [react(), surfaceIsolation()],
  build: {
    outDir: "dist-surface",
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: fileURLToPath(new URL("./surface.html", import.meta.url)),
      output: {
        entryFileNames: "assets/surface-[hash].js",
        chunkFileNames: "assets/surface-chunk-[hash].js",
        assetFileNames: "assets/surface-[hash][extname]",
      },
    },
  },
});
