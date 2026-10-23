import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { officialDocumentQaPaths, prepareOfficialDocumentQaPaths, requireFreshOfficialDocumentQaDist, officialDocumentQaEnvironment } from "./official-document-qa-paths.mjs";

const paths = officialDocumentQaPaths();
if (process.argv.includes("--print-paths") || process.argv.includes("--check-paths")) {
  if (process.argv.includes("--check-paths")) prepareOfficialDocumentQaPaths(paths);
  console.log(JSON.stringify(paths, null, 2));
  process.exit(0);
}
prepareOfficialDocumentQaPaths(paths);
requireFreshOfficialDocumentQaDist(paths);
if (paths.outputRoot !== null) Object.assign(process.env, officialDocumentQaEnvironment(paths));

const identifier = "kr.sungandi.schoolhealthdesk.officialdocumentqa";
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("QA source commit unavailable");

await import("./generate-official-document-qa-fixtures.mjs");
const { build } = await import("vite");
await build({
  configFile: "vite.official-document-qa.config.ts",
  ...(paths.outputRoot === null ? {} : {
    cacheDir: paths.cache,
    configLoader: "runner",
    build: { outDir: paths.dist, emptyOutDir: false },
  }),
});

const forbidden = /supabase\.co|api\.openai\.com|generativelanguage\.googleapis\.com|chatgpt_(?:get|start|disconnect|list|generate)|validate_ai_connection|generate_ai_text|plugin:updater|downloadAndInstall|school-health-desk:\/\/|AiConnectionProvider가 필요합니다\.|ChatGptConnectionProvider가 필요합니다\./;
let inertConnectionBoundaryFound = false;
for (const file of await readdir(join(paths.dist, "assets"))) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(join(paths.dist, "assets", file), "utf8");
  if (forbidden.test(source)) throw new Error(`Production integration found in QA frontend: ${file}`);
  if (source.includes("격리 QA에서는 외부 AI 연결을 사용할 수 없습니다.")) {
    inertConnectionBoundaryFound = true;
  }
}
if (!inertConnectionBoundaryFound) throw new Error("Inert AI boundary missing from QA frontend");

await mkdir(paths.dist, { recursive: true });
await writeFile(
  join(paths.dist, "qa-build.json"),
  `${JSON.stringify({ sourceSha, identifier, externalConnections: false, ...(paths.outputRoot === null ? {} : { frontendDist: paths.dist }) }, null, 2)}\n`,
);
