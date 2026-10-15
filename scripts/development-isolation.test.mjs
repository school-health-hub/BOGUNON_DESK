import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const readJson = async (...segments) => JSON.parse(await readFile(resolve(root, ...segments), "utf8"));

describe("development and production isolation", () => {
  it("keeps the production identity and deep-link scheme unchanged", async () => {
    const config = await readJson("src-tauri", "tauri.conf.json");

    expect(config).toMatchObject({
      identifier: "kr.sungandi.schoolhealthdesk",
      productName: "BOGUNON DESK",
      plugins: { "deep-link": { desktop: { schemes: ["school-health-desk"] } } },
    });
  });

  it("defines a fully isolated development overlay", async () => {
    const config = await readJson("src-tauri", "tauri.dev.conf.json");

    expect(config).toMatchObject({
      identifier: "kr.sungandi.schoolhealthdesk.dev",
      productName: "BOGUNON DESK DEV",
      build: { beforeDevCommand: "npm run dev:frontend" },
      plugins: { "deep-link": { desktop: { schemes: ["school-health-desk-dev"] } } },
    });
    expect(config.app.windows[0].title).toBe("BOGUNON DESK DEV");
  });

  it("exposes only the explicit development command", async () => {
    const manifest = await readJson("package.json");

    expect(manifest.scripts["dev:desktop"]).toBe("tauri dev --config src-tauri/tauri.dev.conf.json");
    expect(manifest.scripts["dev:frontend"]).toBe("vite --mode desktop-dev");
    expect(manifest.scripts["release:windows"]).not.toContain("tauri.dev.conf.json");
    expect(manifest.scripts["release:updater"]).not.toContain("tauri.dev.conf.json");
  });
});
