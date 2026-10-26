import { execFileSync } from "node:child_process"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { build } from "vite"

const identifier = "kr.sungandi.schoolhealthdesk.newsletterqa"
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
if (!/^[a-f0-9]{40}$/u.test(sourceSha)) throw new Error("Newsletter QA source commit unavailable")

await build({ configFile: "vite.newsletter-storage-qa.config.mjs" })
for (const file of await readdir("dist-newsletter-storage-qa/assets")) {
  if (!file.endsWith(".js")) continue
  const source = await readFile(`dist-newsletter-storage-qa/assets/${file}`, "utf8")
  if (/supabase\.co|bogunon\.vercel\.app|plugin:updater|downloadAndInstall/u.test(source)) {
    throw new Error("Production network or updater code detected in Newsletter QA frontend")
  }
}
await mkdir("dist-newsletter-storage-qa", { recursive: true })
await writeFile(
  "dist-newsletter-storage-qa/qa-build.json",
  JSON.stringify({ sourceSha, identifier, entrypoint: "storage.html" }, null, 2),
)
