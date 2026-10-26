import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "qa-finder-integration",
  plugins: [react()],
  resolve: {
    alias: [
      { find: "/src", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: /^.*auth\/authService$/, replacement: fileURLToPath(new URL("./src/finder-integration-qa/authServiceStub.ts", import.meta.url)).replaceAll("\\", "/") },
      { find: /^.*auth\/supabaseClient$/, replacement: fileURLToPath(new URL("./src/education-video-qa/supabaseStub.ts", import.meta.url)).replaceAll("\\", "/") },
    ],
  },
  build: { outDir: "../dist-finder-integration-qa", emptyOutDir: true },
});
