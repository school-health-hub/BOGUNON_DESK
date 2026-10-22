import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectFile = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const inertConnections = projectFile("./src/official-document-qa/inertConnections.ts");
const aiConnectionContext = /^(?:.*[\\/])?ai[\\/]AiConnectionContext(?:\.tsx)?$/u;
const chatGptConnectionContext = /^(?:.*[\\/])?chatgpt[\\/]ChatGptConnectionContext(?:\.tsx)?$/u;

export default defineConfig({
  root: "qa/official-document",
  plugins: [react()],
  resolve: {
    alias: [
      { find: aiConnectionContext, replacement: inertConnections },
      { find: chatGptConnectionContext, replacement: inertConnections },
      { find: "/src", replacement: projectFile("./src") },
    ],
  },
  build: {
    outDir: "../../dist-official-document-qa",
    emptyOutDir: true,
  },
});
