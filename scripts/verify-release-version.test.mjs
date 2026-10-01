import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyReleaseVersion } from "./verify-release-version.mjs";

const createVersionFixture = async ({ packageVersion = "0.2.0", tauriVersion = "0.2.0", cargoVersion = "0.2.0" } = {}) => {
  const root = await mkdtemp(join(tmpdir(), "bogunon-version-"));
  await mkdir(join(root, "src-tauri"), { recursive: true });
  await Promise.all([
    writeFile(join(root, "package.json"), JSON.stringify({ version: packageVersion })),
    writeFile(join(root, "src-tauri", "tauri.conf.json"), JSON.stringify({ version: tauriVersion })),
    writeFile(join(root, "src-tauri", "Cargo.toml"), `[package]\nname = "fixture"\nversion = "${cargoVersion}"\n`),
  ]);
  return root;
};

describe("protected release version guard", () => {
  it("accepts only when workflow, package, Tauri, and Cargo versions match", async () => {
    const root = await createVersionFixture();
    await expect(verifyReleaseVersion({ projectRoot: root, expectedVersion: "0.2.0" })).resolves.toBe("0.2.0");
  });

  it.each([
    ["package", { packageVersion: "0.2.1" }],
    ["Tauri", { tauriVersion: "0.2.1" }],
    ["Cargo", { cargoVersion: "0.2.1" }],
  ])("rejects a %s mismatch", async (_label, versions) => {
    const root = await createVersionFixture(versions);
    await expect(verifyReleaseVersion({ projectRoot: root, expectedVersion: "0.2.0" })).rejects.toThrow("일치하지 않습니다");
  });

  it("rejects malformed workflow input", async () => {
    const root = await createVersionFixture();
    await expect(verifyReleaseVersion({ projectRoot: root, expectedVersion: "main" })).rejects.toThrow("SemVer");
  });
});
