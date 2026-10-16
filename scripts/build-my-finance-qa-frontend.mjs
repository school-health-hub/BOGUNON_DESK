import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { build } from "vite";
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw Error("QA source commit unavailable");
await build({ configFile: "vite.my-finance-qa.config.ts" });
// The isolated bundle must contain no account/updater or production server code.
const manifest = await import("node:fs/promises");
for (const file of await manifest.readdir("dist-my-finance-qa/assets")) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(`dist-my-finance-qa/assets/${file}`, "utf8");
  if (/supabase\.co|bogunon\.vercel\.app|plugin:updater|downloadAndInstall/.test(source)) throw Error("Production network/updater code in QA frontend");
}
await mkdir("dist-my-finance-qa", { recursive: true });
await writeFile("dist-my-finance-qa/qa-build.json", JSON.stringify({ sourceSha, identifier: "kr.sungandi.schoolhealthdesk.myfinanceqa" }, null, 2));
