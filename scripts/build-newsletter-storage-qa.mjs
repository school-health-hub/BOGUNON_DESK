import { execFileSync, spawnSync } from "node:child_process"

const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
if (!/^[a-f0-9]{40}$/u.test(sourceSha)) throw new Error("Newsletter QA source commit unavailable")
if (status.length > 0) throw new Error("Commit changes before packaging a traceable Newsletter QA executable")
if (process.platform !== "win32") throw new Error("Newsletter Storage QA executable requires Windows MSVC")

const result = spawnSync(
  process.execPath,
  [
    "node_modules/@tauri-apps/cli/tauri.js",
    "build",
    "--target",
    "x86_64-pc-windows-msvc",
    "--features",
    "newsletter-storage-qa",
    "--config",
    "src-tauri/tauri.newsletter-storage-qa.conf.json",
    "--no-bundle",
  ],
  { stdio: "inherit", env: { ...process.env, NEWSLETTER_QA_SOURCE_SHA: sourceSha } },
)
process.exit(result.status ?? 1)
