import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { build } from "vite";

const identifier = "kr.sungandi.schoolhealthdesk.officialdocumentqa";
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("QA source commit unavailable");

await import("./generate-official-document-qa-fixtures.mjs");
await build({ configFile: "vite.official-document-qa.config.ts" });

const forbidden = /supabase\.co|api\.openai\.com|generativelanguage\.googleapis\.com|chatgpt_(?:get|start|disconnect|list|generate)|validate_ai_connection|generate_ai_text|plugin:updater|downloadAndInstall|school-health-desk:\/\//;
for (const file of await readdir("dist-official-document-qa/assets")) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(`dist-official-document-qa/assets/${file}`, "utf8");
  if (forbidden.test(source)) throw new Error(`Production integration found in QA frontend: ${file}`);
}

await mkdir("dist-official-document-qa", { recursive: true });
await writeFile(
  "dist-official-document-qa/qa-build.json",
  `${JSON.stringify({ sourceSha, identifier, externalConnections: false }, null, 2)}\n`,
);
