import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  root: "qa/newsletter",
  resolve: { alias: { "/src": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "../../dist-newsletter-storage-qa",
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./qa/newsletter/storage.html", import.meta.url)) },
  },
})
