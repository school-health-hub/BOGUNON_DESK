import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { officialDocumentQaPaths, prepareOfficialDocumentQaPaths, officialDocumentQaConfig, officialDocumentQaEnvironment } from "./official-document-qa-paths.mjs";

const paths = officialDocumentQaPaths();
const config = JSON.parse(readFileSync("src-tauri/tauri.official-document-qa.conf.json", "utf8"));
const qaConfig = officialDocumentQaConfig(config, paths);
if (process.argv.includes("--print-paths") || process.argv.includes("--check-paths")) {
  if (process.argv.includes("--check-paths")) prepareOfficialDocumentQaPaths(paths);
  console.log(JSON.stringify({ ...paths, tauriConfig: qaConfig }, null, 2));
  process.exit(0);
}
prepareOfficialDocumentQaPaths(paths);

const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const approvedFiles = new Set([
  ".gitignore",
  "package.json",
  "src-tauri/.gitignore",
  "src-tauri/Cargo.toml",
  "src-tauri/build.rs",
  "src-tauri/src/lib.rs",
  "src-tauri/src/official_document_import.rs",
  "src-tauri/src/official_document_qa.rs",
  "src-tauri/tauri.official-document-qa.conf.json",
  "vite.official-document-qa.config.ts",
  "scripts/build-official-document-qa-frontend.mjs",
  "scripts/build-official-document-qa.mjs",
  "scripts/official-document-qa-paths.mjs",
  "scripts/official-document-qa-paths.test.mjs",
  "docs/OFFICIAL_DOCUMENT_QA_PATHS.md",
  "src/components/desktop/OfficialDocumentOutput.tsx",
  "src/components/desktop/OfficialDocumentOutput.test.tsx",
  "src/styles/components.css",
  "Microsoft/Windows/PowerShell/ModuleAnalysisCache",
  "scripts/generate-official-document-qa-fixtures.mjs",
]);
const approvedDirectories = ["qa/official-document/", "src/official-document-qa/"];
const changedPaths = execFileSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all"],
  { encoding: "utf8" },
).split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3).replaceAll("\\", "/"));
const unexpectedPath = changedPaths.find((path) => (
  !approvedFiles.has(path)
  && !approvedDirectories.some((directory) => path.startsWith(directory))
));
if (unexpectedPath !== undefined) {
  throw new Error(`Unexpected worktree change blocks QA build: ${unexpectedPath}`);
}
if (process.platform !== "win32") throw new Error("Official-document QA requires Windows MSVC");

if (
  config.identifier !== "kr.sungandi.schoolhealthdesk.officialdocumentqa"
  || config.mainBinaryName !== "bogunon-desk-official-document-qa"
  || config.app?.windows?.[0]?.dataDirectory !== "official-document-qa-webview"
  || config.bundle?.active !== false
) {
  throw new Error("Official-document QA isolation config mismatch");
}
const stamp = JSON.parse(readFileSync(join(paths.dist, "qa-build.json"), "utf8"));
if (stamp.sourceSha !== sourceSha || stamp.identifier !== config.identifier || stamp.externalConnections !== false
  || (paths.outputRoot !== null && stamp.frontendDist !== paths.dist)) {
  throw new Error("Official-document QA frontend stamp mismatch");
}

const targetDirectory = paths.target;
const executable = resolve(
  targetDirectory,
  "x86_64-pc-windows-msvc/release/bogunon-desk-official-document-qa.exe",
);
if (existsSync(executable)) {
  throw new Error(`Refusing to overwrite an existing QA executable: ${executable}`);
}

const result = spawnSync(
  process.execPath,
  [
    "node_modules/@tauri-apps/cli/tauri.js",
    "build",
    "--target", "x86_64-pc-windows-msvc",
    "--features", "official-document-qa",
    "--config", paths.outputRoot === null ? "src-tauri/tauri.official-document-qa.conf.json" : JSON.stringify(qaConfig),
    "--no-bundle",
    "--",
    "--locked",
    "--offline",
  ],
  {
    stdio: "inherit",
    env: {
      ...officialDocumentQaEnvironment(paths),
      BOGUNON_OFFICIAL_DOCUMENT_QA_SOURCE_SHA: sourceSha,
      CARGO_NET_OFFLINE: "true",
      CARGO_TARGET_DIR: targetDirectory,
    },
  },
);
process.exit(result.status ?? 1);
