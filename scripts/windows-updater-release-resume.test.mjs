import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(import.meta.dirname, "..", ".github", "workflows", "windows-updater-release-resume.yml");

describe("Windows updater release resume workflow", () => {
  it("reuses a signed candidate from an earlier workflow run", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("candidate_run_id:");
    expect(source).toContain("checkpoint_run_id:");
    expect(source).toContain("resume_from:");
    expect(source).toContain("run-id: ${{ inputs.candidate_run_id }}");
    expect(source).toContain("github-token: ${{ github.token }}");
    expect(source).toContain("RELEASE_CANDIDATE_RUN_ID: ${{ inputs.candidate_run_id }}");
  });

  it("blocks candidate reuse when product-affecting files changed", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("Candidate reuse blocked because product-affecting files changed");
    expect(source).toContain("^scripts/qa/");
    expect(source).toContain("^\\.github/workflows/windows-updater-release[^/]*\\.yml$");
    expect(source).toContain("candidate-build-context.json");
    expect(source).toContain("Candidate source SHA does not match the original candidate run.");
  });

  it("supports resuming from each release checkpoint without rebuilding the candidate", async () => {
    const source = await readFile(workflowPath, "utf8");
    for (const stage of [
      "clean-install",
      "updater-qa",
      "publish-versioned",
      "verify-versioned",
      "metadata",
      "promote-latest",
      "verify-latest",
      "cleanup-candidate",
    ]) {
      expect(source).toContain(`- ${stage}`);
    }
    expect(source).not.toContain("npm run release:updater");
    expect(source).not.toContain("TAURI_SIGNING_PRIVATE_KEY");
  });

  it("verifies prerequisite checkpoints before starting the selected stage", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("function Assert-Checkpoint");
    expect(source).toContain("Run exact-byte clean install QA");
    expect(source).toContain("Run synthetic updater compatibility QA");
    expect(source).toContain("Publish versioned immutable objects");
    expect(source).toContain("Verify public latest pointer");
  });
});
