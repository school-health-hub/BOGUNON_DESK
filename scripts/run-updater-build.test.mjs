import { describe, expect, it } from "vitest";
import { createUpdaterBuildEnvironment } from "./run-updater-build.mjs";

describe("updater build signing environment", () => {
  it("passes the official signing variable through unchanged", () => {
    const result = createUpdaterBuildEnvironment({ TAURI_SIGNING_PRIVATE_KEY: "fixture-key-source", KEEP: "yes" });
    expect(result).toMatchObject({ TAURI_SIGNING_PRIVATE_KEY: "fixture-key-source", KEEP: "yes" });
  });

  it("maps the path convenience variable without reading its target", () => {
    const result = createUpdaterBuildEnvironment({ TAURI_SIGNING_PRIVATE_KEY_PATH: "Z:\\fixture\\not-a-real-key" });
    expect(result.TAURI_SIGNING_PRIVATE_KEY).toBe("Z:\\fixture\\not-a-real-key");
    expect(result).not.toHaveProperty("TAURI_SIGNING_PRIVATE_KEY_PATH");
  });

  it("prefers the official variable when both are set", () => {
    const result = createUpdaterBuildEnvironment({
      TAURI_SIGNING_PRIVATE_KEY: "fixture-direct",
      TAURI_SIGNING_PRIVATE_KEY_PATH: "fixture-path",
    });
    expect(result.TAURI_SIGNING_PRIVATE_KEY).toBe("fixture-direct");
  });

  it("rejects an absent signing key source", () => {
    expect(() => createUpdaterBuildEnvironment({})).toThrow("private key source");
  });
});
