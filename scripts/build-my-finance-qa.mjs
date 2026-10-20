import { execFileSync, spawnSync } from "node:child_process";
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw Error("Commit changes before packaging a traceable QA installer");
if (process.platform !== "win32") throw Error("QA installer requires Windows MSVC");
const result = spawnSync(process.execPath, ["node_modules/@tauri-apps/cli/tauri.js", "build", "--target", "x86_64-pc-windows-msvc", "--features", "my-finance-qa", "--config", "src-tauri/tauri.my-finance-qa.conf.json", "--bundles", "nsis"], { stdio: "inherit", env: { ...process.env, BOGUNON_QA_SOURCE_SHA: sourceSha } });
process.exit(result.status ?? 1);
