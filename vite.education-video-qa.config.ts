import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "qa-education-video",
  plugins: [react()],
  resolve: {
    alias: [
      { find: "/src", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: "../auth/supabaseClient", replacement: fileURLToPath(new URL("./src/education-video-qa/supabaseStub.ts", import.meta.url)) },
    ],
  },
  build: { outDir: "../dist-education-video-qa", emptyOutDir: true },
});
