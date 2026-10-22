import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const approvedFiles = new Set([
  ".gitignore",
  "package.json",
  "src-tauri/.gitignore",
  "src-tauri/Cargo.toml",
  "src-tauri/build.rs",
  "src-tauri/src/lib.rs",
  "src-tauri/src/official_document_qa.rs",
  "src-tauri/tauri.official-document-qa.conf.json",
  "vite.official-document-qa.config.ts",
  "scripts/build-official-document-qa-frontend.mjs",
  "scripts/build-official-document-qa.mjs",
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

const config = JSON.parse(readFileSync("src-tauri/tauri.official-document-qa.conf.json", "utf8"));
if (
  config.identifier !== "kr.sungandi.schoolhealthdesk.officialdocumentqa"
  || config.mainBinaryName !== "bogunon-desk-official-document-qa"
  || config.app?.windows?.[0]?.dataDirectory !== "official-document-qa-webview"
  || config.bundle?.active !== false
) {
  throw new Error("Official-document QA isolation config mismatch");
}
const stamp = JSON.parse(readFileSync("dist-official-document-qa/qa-build.json", "utf8"));
if (stamp.sourceSha !== sourceSha || stamp.identifier !== config.identifier || stamp.externalConnections !== false) {
  throw new Error("Official-document QA frontend stamp mismatch");
}

const targetDirectory = resolve("src-tauri/target-official-document-qa");
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
    "--config", "src-tauri/tauri.official-document-qa.conf.json",
    "--no-bundle",
    "--",
    "--locked",
    "--offline",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      BOGUNON_OFFICIAL_DOCUMENT_QA_SOURCE_SHA: sourceSha,
      CARGO_NET_OFFLINE: "true",
      CARGO_TARGET_DIR: targetDirectory,
    },
  },
);
process.exit(result.status ?? 1);
