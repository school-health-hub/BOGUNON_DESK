import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const localSurfaceAssets = {
  name: "local-surface-assets",
  enforce: "post" as const,
  transformIndexHtml(html: string): string {
    return html.replaceAll(" crossorigin", "");
  },
};

export default defineConfig({
  base: "./",
  plugins: [react(), localSurfaceAssets],
  server: { host: "127.0.0.1", port: 1431, strictPort: true },
  preview: { host: "127.0.0.1", port: 1432, strictPort: true },
  build: {
    outDir: "dist-surface-preview",
    emptyOutDir: true,
    rollupOptions: { input: "surface.html" },
  },
});
