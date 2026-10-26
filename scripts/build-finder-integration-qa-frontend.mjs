import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { build } from "vite";

const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("QA source commit unavailable");
await build({ configFile: "vite.finder-integration-qa.config.ts" });
for (const file of await readdir("dist-finder-integration-qa/assets")) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(`dist-finder-integration-qa/assets/${file}`, "utf8");
  if (/https:\/\/[^"']*supabase\.co|plugin:updater|downloadAndInstall/.test(source)) {
    throw new Error("Production integration code in Finder integration QA frontend");
  }
}
await mkdir("dist-finder-integration-qa", { recursive: true });
await writeFile("dist-finder-integration-qa/qa-build.json", JSON.stringify({
  sourceSha,
  identifier: "kr.sungandi.schoolhealthdesk.finderintegrationqa",
  externalConnections: false,
  oauthNativeCommandRegistered: false,
}, null, 2));
