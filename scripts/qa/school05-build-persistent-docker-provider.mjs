import { build } from "vite";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

if (process.platform !== "win32") throw new Error("Windows persistent Docker provider build only");
await build({
  configFile: false,
  plugins: [{
    name: "isolated-persistent-docker-pg",
    enforce: "pre",
    resolveId(source, importer) {
      if (importer?.replaceAll("\\", "/").endsWith("/school05/server/provider.ts") && source === "./local-db.js") {
        return resolve("scripts/qa/school05-persistent-docker.ts");
      }
    },
  }],
  build: {
    ssr: "school-workspace/school05/server/provider.ts",
    outDir: "build/school05-qa",
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "provider.mjs" } },
  },
});

const bundled = await readFile("build/school05-qa/provider.mjs", "utf8");
if (!bundled.includes("SCHOOL05_PERSISTENT_DOCKER") || !bundled.includes("__BOGUNON_QUERY_")) {
  throw new Error("Persistent Docker QA backend bundling mismatch");
}
