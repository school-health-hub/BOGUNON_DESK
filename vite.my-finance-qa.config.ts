import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error Node types are not installed for config files
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: "qa", plugins: [react()],
  resolve: { alias: { "/src": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../dist-my-finance-qa", emptyOutDir: true },
});
