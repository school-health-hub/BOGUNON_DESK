import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { build } from "vite";

const identifier = "kr.sungandi.schoolhealthdesk.officialdocumentqa";
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("QA source commit unavailable");

await import("./generate-official-document-qa-fixtures.mjs");
await build({ configFile: "vite.official-document-qa.config.ts" });

const forbidden = /supabase\.co|api\.openai\.com|generativelanguage\.googleapis\.com|chatgpt_(?:get|start|disconnect|list|generate)|validate_ai_connection|generate_ai_text|plugin:updater|downloadAndInstall|school-health-desk:\/\/|AiConnectionProvider가 필요합니다\.|ChatGptConnectionProvider가 필요합니다\./;
let inertConnectionBoundaryFound = false;
for (const file of await readdir("dist-official-document-qa/assets")) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(`dist-official-document-qa/assets/${file}`, "utf8");
  if (forbidden.test(source)) throw new Error(`Production integration found in QA frontend: ${file}`);
  if (source.includes("격리 QA에서는 외부 AI 연결을 사용할 수 없습니다.")) {
    inertConnectionBoundaryFound = true;
  }
}
if (!inertConnectionBoundaryFound) throw new Error("Inert AI boundary missing from QA frontend");

await mkdir("dist-official-document-qa", { recursive: true });
await writeFile(
  "dist-official-document-qa/qa-build.json",
  `${JSON.stringify({ sourceSha, identifier, externalConnections: false }, null, 2)}\n`,
);
