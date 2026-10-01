import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("Tauri updater foundation", () => {
  it("configures the exact native endpoint and passive Windows installation", async () => {
    const config = JSON.parse(await readFile(resolve(root, "src-tauri", "tauri.conf.json"), "utf8"));

    expect(config.plugins.updater.endpoints).toEqual([
      "https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases/latest.json",
    ]);
    expect(config.plugins.updater.windows.installMode).toBe("passive");
    expect(config.plugins.updater.pubkey).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
    expect(config.bundle.createUpdaterArtifacts).not.toBe(true);
  });

  it("enables updater artifacts only in the release overlay", async () => {
    const [baseConfig, releaseConfig] = await Promise.all([
      readFile(resolve(root, "src-tauri", "tauri.conf.json"), "utf8").then(JSON.parse),
      readFile(resolve(root, "src-tauri", "tauri.release.conf.json"), "utf8").then(JSON.parse),
    ]);
    expect(baseConfig.bundle.createUpdaterArtifacts).not.toBe(true);
    expect(releaseConfig.bundle.createUpdaterArtifacts).toBe(true);
  });

  it("grants only check and combined download-install updater permissions", async () => {
    const capability = JSON.parse(await readFile(
      resolve(root, "src-tauri", "capabilities", "default.json"),
      "utf8",
    ));
    const updaterPermissions = capability.permissions.filter((permission) => permission.startsWith("updater:"));

    expect(updaterPermissions).toEqual([
      "updater:allow-check",
      "updater:allow-download-and-install",
    ]);
  });
});
