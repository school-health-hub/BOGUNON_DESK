import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"

it("builds a pinned, read-only Windows portable QA artifact", async () => {
  const workflow = await readFile(new URL("../.github/workflows/newsletter-ns3d-webview2-qa.yml", import.meta.url), "utf8")

  expect(workflow).toContain("runs-on: windows-2025")
  expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/u)
  expect(workflow).toContain("persist-credentials: false")
  expect(workflow).toContain('node-version: "22.23.3"')
  expect(workflow).toContain('toolchain: "1.98.1"')
  expect(workflow).toContain("cargo test --locked")
  expect(workflow).toContain("cargo check --locked")
  expect(workflow).toContain("npm run qa:newsletter-storage:windows")
  expect(workflow).toContain("Compress-Archive")
  expect(workflow).toContain("SHA256SUMS.txt")
  expect(workflow).toContain("retention-days: 7")
  expect(workflow).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
  expect(workflow).not.toMatch(/secrets\.|deploy|signing|updater/u)
})
