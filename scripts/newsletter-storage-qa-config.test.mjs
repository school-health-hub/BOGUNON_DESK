import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")

it("isolates the Newsletter Storage QA identity, frontend, and native plugins", async () => {
  const production = JSON.parse(await read("src-tauri/tauri.conf.json"))
  const qa = JSON.parse(await read("src-tauri/tauri.newsletter-storage-qa.conf.json"))

  expect(production.identifier).toBe("kr.sungandi.schoolhealthdesk")
  expect(production.productName).toBe("BOGUNON DESK")
  expect(qa.identifier).toBe("kr.sungandi.schoolhealthdesk.newsletterqa")
  expect(qa.identifier).not.toBe(production.identifier)
  expect(qa.productName).toBe("BOGUNON DESK Newsletter Storage QA")
  expect(qa.mainBinaryName).toBe("bogunon-desk-newsletter-storage-qa")
  expect(qa.build.frontendDist).toBe("../dist-newsletter-storage-qa")
  expect(qa.build.devUrl).toBeNull()
  expect(qa.app.windows).toHaveLength(1)
  expect(qa.app.windows[0].url).toBe("storage.html")
  expect(qa.plugins).toEqual({ updater: null, "deep-link": null })
  expect(JSON.stringify(qa.app.security.csp)).not.toMatch(/https:|supabase|bogunon\.vercel/u)
  expect(qa.app.security.csp["font-src"]).toBe("'self'")

  const rasterizer = await read("src/newsletter/output/browserRasterizer.ts")
  expect(rasterizer).toContain('PretendardVariable.woff2?url')
  expect(rasterizer).toContain("new URL(pretendardFontUrl, window.location.href).href")

  const native = await read("src-tauri/src/newsletter_storage_qa.rs")
  expect(native).toContain("newsletter_output_pick_target")
  expect(native).toContain("newsletter_output_save")
  expect(native).toContain("newsletter_output_last_success")
  expect(native).toContain("newsletter_output_recover")
  expect(native).toContain("newsletter_storage_qa_info")
  expect(native).toContain("tauri_plugin_dialog::init()")
  expect(native).not.toMatch(/tauri_plugin_(updater|autostart|single_instance|notification|store|deep_link)/u)
  expect(native).not.toMatch(/create_tray|DesktopState|desktop_surface/u)
})

it("binds the frontend and native QA build to the same source commit", async () => {
  const buildScript = await read("src-tauri/build.rs")
  const frontendBuilder = await read("scripts/build-newsletter-storage-qa-frontend.mjs")
  const nativeBuilder = await read("scripts/build-newsletter-storage-qa.mjs")

  expect(buildScript).toContain("CARGO_FEATURE_NEWSLETTER_STORAGE_QA")
  expect(buildScript).toContain("../dist-newsletter-storage-qa/qa-build.json")
  expect(buildScript).toContain("kr.sungandi.schoolhealthdesk.newsletterqa")
  expect(buildScript).toContain("bogunon-desk-newsletter-storage-qa")
  expect(buildScript).toContain("NEWSLETTER_QA_SOURCE_SHA")
  expect(frontendBuilder).toContain("qa-build.json")
  expect(frontendBuilder).toContain("sourceSha")
  expect(nativeBuilder).toContain("NEWSLETTER_QA_SOURCE_SHA")
  expect(nativeBuilder).toContain("newsletter-storage-qa")
  expect(nativeBuilder).toContain("--no-bundle")
})
