import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectFile = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const inertConnections = projectFile("./src/official-document-qa/inertConnections.ts");

export default defineConfig({
  root: "qa/official-document",
  plugins: [react()],
  resolve: {
    alias: [
      { find: projectFile("./src/ai/AiConnectionContext.tsx"), replacement: inertConnections },
      { find: projectFile("./src/chatgpt/ChatGptConnectionContext.tsx"), replacement: inertConnections },
      { find: "/src", replacement: projectFile("./src") },
    ],
  },
  build: {
    outDir: "../../dist-official-document-qa",
    emptyOutDir: true,
  },
});
