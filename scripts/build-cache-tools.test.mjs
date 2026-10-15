import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const incremental = resolve(root, "src-tauri", "target", "debug", "incremental");

const runPowerShell = (script, args = []) => spawnSync(
  "pwsh",
  ["-NoProfile", "-File", resolve(root, "scripts", script), ...args],
  { cwd: root, encoding: "utf8" },
);

describe("build cache tools", () => {
  it("audits without changing the incremental cache", () => {
    const existedBefore = existsSync(incremental);

    const result = runPowerShell("audit-build-cache.ps1");

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("Mode: Fast");
    expect(result.stdout).toContain("skipped in Fast mode");
    expect(existsSync(incremental)).toBe(existedBefore);
  }, 15_000);

  it("defaults cleanup to a dry run", () => {
    const existedBefore = existsSync(incremental);

    const result = runPowerShell("clean-build-cache.ps1", ["-Scope", "Incremental"]);

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("DRY RUN");
    expect(existsSync(incremental)).toBe(existedBefore);
  }, 15_000);

  it("rejects a repository path outside the protected project", () => {
    const result = runPowerShell("clean-build-cache.ps1", [
      "-Scope", "Incremental",
      "-RepositoryRoot", resolve(root, "scripts"),
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("BOGUNON_DESK repository root");
  });

  it("does not expose release or whole-target cleanup scopes", () => {
    const result = runPowerShell("clean-build-cache.ps1", ["-Scope", "Release"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ValidateSet");
  });
});
