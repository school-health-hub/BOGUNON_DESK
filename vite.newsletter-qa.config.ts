import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  root: "qa/newsletter",
  plugins: [react()],
  resolve: { alias: { "/src": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../../dist-newsletter-qa", emptyOutDir: true },
})
