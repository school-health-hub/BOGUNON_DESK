import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "qa-education-video",
  plugins: [react()],
  resolve: { alias: { "/src": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../dist-education-video-qa", emptyOutDir: true },
});
