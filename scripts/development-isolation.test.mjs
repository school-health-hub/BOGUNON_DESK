import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const readJson = async (...segments) => JSON.parse(await readFile(resolve(root, ...segments), "utf8"));

const mergePatch = (target, patch) => {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const result = target !== null && typeof target === "object" && !Array.isArray(target)
    ? { ...target }
    : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = mergePatch(result[key], value);
  }
  return result;
};

describe("development and production isolation", () => {
  it("keeps the production identity and deep-link scheme unchanged", async () => {
    const config = await readJson("src-tauri", "tauri.conf.json");

    expect(config).toMatchObject({
      identifier: "kr.sungandi.schoolhealthdesk",
      productName: "BOGUNON DESK",
      plugins: { "deep-link": { desktop: { schemes: ["school-health-desk"] } } },
    });
    expect(config.plugins.updater).toEqual({
      pubkey: "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEMxQ0EzQjg1OTYwQkNFQ0YKUldUUHpndVdoVHZLd1R4eWJWK2JnMFQ5UmVUU2pzREtzNEN1UTJWUkxJNEtkeEZrd2lVRGJHK1QK",
      endpoints: ["https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases/latest.json"],
      windows: { installMode: "passive" },
    });
  });

  it("defines a fully isolated development overlay", async () => {
    const baseConfig = await readJson("src-tauri", "tauri.conf.json");
    const overlay = await readJson("src-tauri", "tauri.dev.conf.json");
    const config = mergePatch(baseConfig, overlay);

    expect(config).toMatchObject({
      identifier: "kr.sungandi.schoolhealthdesk.dev",
      productName: "BOGUNON DESK DEV",
      build: { beforeDevCommand: "npm run dev:frontend" },
      plugins: { "deep-link": { desktop: { schemes: ["school-health-desk-dev"] } } },
    });
    expect(config.app.windows[0].title).toBe("BOGUNON DESK DEV");
    expect(config.plugins.updater).toBeUndefined();
    expect(overlay.plugins.updater).toBeNull();
  });

  it("exposes only the explicit development command", async () => {
    const manifest = await readJson("package.json");

    expect(manifest.scripts["dev:desktop"]).toBe("tauri dev --config src-tauri/tauri.dev.conf.json");
    expect(manifest.scripts["dev:frontend"]).toBe("vite --mode desktop-dev");
    expect(manifest.scripts["release:windows"]).not.toContain("tauri.dev.conf.json");
    expect(manifest.scripts["release:updater"]).not.toContain("tauri.dev.conf.json");
  });
});
