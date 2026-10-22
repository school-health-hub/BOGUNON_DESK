import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { build } from "vite";

const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("QA source commit unavailable");
await build({ configFile: "vite.education-video-qa.config.ts" });
for (const file of await readdir("dist-education-video-qa/assets")) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(`dist-education-video-qa/assets/${file}`, "utf8");
  if (/supabase\.co|bogunon\.vercel\.app|plugin:updater|downloadAndInstall/.test(source)) throw new Error("Production integration code in Finder QA frontend");
}
await mkdir("dist-education-video-qa", { recursive: true });
await writeFile("dist-education-video-qa/qa-build.json", JSON.stringify({ sourceSha, identifier: "kr.sungandi.schoolhealthdesk.educationvideoqa" }, null, 2));
