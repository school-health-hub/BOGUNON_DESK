import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(import.meta.dirname, "..", ".github", "workflows", "windows-updater-release.yml");
const readWorkflow = () => readFile(workflowPath, "utf8");
const jobBlock = (source, name) => {
  const start = source.indexOf(`  ${name}:`);
  if (start < 0) return "";
  const nextMatch = /\n  [A-Za-z0-9_-]+:/gu.exec(source.slice(start + `  ${name}:`.length));
  const next = nextMatch === null ? -1 : start + `  ${name}:`.length + nextMatch.index;
  return source.slice(start, next < 0 ? source.length : next);
};
const stepBlock = (source, name) => {
  const start = source.indexOf(`      - name: ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\n      - name:", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
};

describe("protected Windows updater release workflow", () => {
  it("is manual-only and bound to the protected production environment with read-only GitHub access", async () => {
    const source = await readWorkflow();
    expect(source).toMatch(/on:\s*\n\s+workflow_dispatch:/u);
    expect(source).not.toMatch(/^\s+(pull_request|push|schedule):/mu);
    expect(source).toContain("environment: desktop-production-release");
    expect(source).toMatch(/permissions:\s*\n\s+contents: read/u);
    expect(source).not.toMatch(/contents: write|packages: write|actions: write|id-token: write/u);
  });

  it("serializes production publication without cancelling an in-progress release", async () => {
    const source = await readWorkflow();
    expect(source).toMatch(/concurrency:\s*\n\s+group: desktop-production-release\s*\n\s+cancel-in-progress: false/u);
  });

  it("requires a version and rejects non-main dispatches before a trusted SHA checkout", async () => {
    const source = await readWorkflow();
    expect(source).toMatch(/version:\s*\n\s+description:[^\n]+\n\s+required: true/u);
    expect(source).toContain('if ($env:GITHUB_REF -ne "refs/heads/main")');
    expect(source).toContain("ref: ${{ github.sha }}");
    expect(source).not.toContain("ref: ${{ inputs.");
    expect(source).toContain("npm run release:version:check");
  });

  it("scopes signing and storage secrets to only the jobs that need them", async () => {
    const source = await readWorkflow();
    const buildCandidate = jobBlock(source, "build-candidate");
    const cleanInstall = jobBlock(source, "clean-install-candidate");
    const updaterQa = jobBlock(source, "updater-compatibility-qa");
    const publishCandidate = jobBlock(source, "publish-candidate-endpoint");
    const promoteLatest = jobBlock(source, "promote-latest");
    const verifyVersioned = jobBlock(source, "verify-versioned");
    const verifyLatest = jobBlock(source, "verify-public-latest");

    expect(buildCandidate).toContain("TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}");
    expect(buildCandidate).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}");
    expect(buildCandidate).not.toContain("SUPABASE_RELEASE_STORAGE_KEY");
    expect(cleanInstall).not.toMatch(/TAURI_SIGNING_PRIVATE_KEY|SUPABASE_RELEASE_STORAGE_KEY/u);
    expect(updaterQa).not.toMatch(/TAURI_SIGNING_PRIVATE_KEY|SUPABASE_RELEASE_STORAGE_KEY/u);
    expect(publishCandidate).toContain("SUPABASE_RELEASE_STORAGE_KEY: ${{ secrets.SUPABASE_RELEASE_STORAGE_KEY }}");
    expect(promoteLatest).toContain("SUPABASE_RELEASE_STORAGE_KEY: ${{ secrets.SUPABASE_RELEASE_STORAGE_KEY }}");
    expect(verifyVersioned).not.toContain("SUPABASE_RELEASE_STORAGE_KEY");
    expect(verifyLatest).not.toContain("SUPABASE_RELEASE_STORAGE_KEY");
    expect(source).toContain("VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}");
    expect(source).toContain("VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}");
    expect(source).not.toMatch(/gh release|git tag|create-release|contents: write/u);
  });

  it("builds the signed production candidate once and downstream jobs download that artifact", async () => {
    const source = await readWorkflow();
    const buildCandidate = jobBlock(source, "build-candidate");
    const afterBuild = source.slice(source.indexOf("  publish-candidate-endpoint:"));

    expect(buildCandidate).toContain("npm run release:updater");
    expect(source).toContain("RELEASE_CANDIDATE_RUN_ID: ${{ github.run_id }}");
    expect(source).toContain("RELEASE_CANDIDATE_ARTIFACT: updater-release-candidate-${{ inputs.version }}-${{ github.run_id }}");
    expect(source).not.toContain("RELEASE_CANDIDATE_RUN_ID: ${{ github.run_id }}-${{ github.run_attempt }}");
    expect(buildCandidate).toContain("Restore existing candidate artifact on rerun");
    expect(buildCandidate).toContain("Require restored candidate on rerun");
    expect(buildCandidate).toContain("[int]$env:RUN_ATTEMPT -gt 1");
    expect(buildCandidate).toContain("rebuilding/signing is blocked");
    expect(buildCandidate).toContain("Upload canonical candidate artifact");
    expect(afterBuild).not.toContain("npm run release:updater");
    expect(afterBuild).not.toContain("run-updater-build.mjs");
    expect(afterBuild).not.toContain("tauri build");
    expect(afterBuild.match(/actions\/download-artifact@/gu)?.length ?? 0).toBeGreaterThanOrEqual(7);
  });

  it("gates latest promotion behind exact-byte clean install, synthetic updater QA, and metadata publish", async () => {
    const source = await readWorkflow();
    const publishVersioned = jobBlock(source, "publish-versioned");
    const verifyVersioned = jobBlock(source, "verify-versioned");
    const publishMetadata = jobBlock(source, "publish-release-metadata");
    const promoteLatest = jobBlock(source, "promote-latest");
    const verifyLatest = jobBlock(source, "verify-public-latest");
    const updaterQa = jobBlock(source, "updater-compatibility-qa");

    expect(updaterQa).toContain("- clean-install-candidate");
    expect(publishVersioned).toContain("- clean-install-candidate");
    expect(publishVersioned).toContain("- updater-compatibility-qa");
    expect(verifyVersioned).toContain("- publish-versioned");
    expect(publishMetadata).toContain("- verify-versioned");
    expect(promoteLatest).toContain("- clean-install-candidate");
    expect(promoteLatest).toContain("- updater-compatibility-qa");
    expect(promoteLatest).toContain("- publish-release-metadata");
    expect(verifyLatest).toContain("- promote-latest");
    expect(stepBlock(source, "Promote public latest pointer")).toContain("RELEASE_PUBLISH_MODE: latest");
    expect(source.indexOf("RELEASE_PUBLISH_MODE: latest")).toBeGreaterThan(source.indexOf("RELEASE_PUBLISH_MODE: metadata"));
  });

  it("records synthetic upgrade limitation evidence without claiming public 0.2.0 exact-byte QA", async () => {
    const source = await readWorkflow();
    expect(source).toContain("UPGRADE_QA_MODE = SYNTHETIC_0_2_0_ENDPOINT_OVERLAY");
    expect(source).toContain("production 0.2.0 exact installer bytes: NOT TESTED");
    expect(source).toContain("updater protocol/signature/install compatibility: PENDING");
    expect(source).toContain("production 0.2.1 candidate bytes: PENDING");
    expect(source).not.toContain("public 0.2.0 installer exact-byte upgrade QA");
  });

  it("uploads sanitized evidence from every publish and promotion job", async () => {
    const source = await readWorkflow();
    for (const jobName of [
      "publish-versioned",
      "verify-versioned",
      "publish-release-metadata",
      "promote-latest",
      "verify-public-latest",
      "cleanup-candidate-endpoint",
      "retain-candidate-endpoint",
    ]) {
      const block = jobBlock(source, jobName);
      expect(block).toContain("if: always()");
      expect(block).toContain("artifacts/release-candidate/**");
    }
  });

  it("pins third-party actions and cleans up the public candidate endpoint only after public latest verification", async () => {
    const source = await readWorkflow();
    expect(source).not.toMatch(/uses: [^\n]+@(v\d+|stable)\b/u);
    const cleanup = jobBlock(source, "cleanup-candidate-endpoint");
    expect(cleanup).toContain("needs.verify-public-latest.result == 'success'");
    expect(cleanup).toContain("RELEASE_PUBLISH_MODE: cleanup-candidate");
    expect(cleanup).toContain("SUPABASE_RELEASE_STORAGE_KEY: ${{ secrets.SUPABASE_RELEASE_STORAGE_KEY }}");
    const retention = jobBlock(source, "retain-candidate-endpoint");
    expect(retention).toContain("needs.verify-public-latest.result != 'success'");
    expect(retention).toContain("candidate namespace is retained");
    expect(retention).not.toContain("SUPABASE_RELEASE_STORAGE_KEY");
    expect(retention).toContain("manual cleanup required");
  });

  it("keeps the synthetic source ref as explicit release configuration and passes it to QA", async () => {
    const source = await readWorkflow();
    const updaterQa = jobBlock(source, "updater-compatibility-qa");
    expect(source).toContain("SYNTHETIC_0_2_0_SOURCE_REF: 2de999ac3bfc6ffec738634866780ab72ddb6d41");
    expect(updaterQa).toContain("SYNTHETIC_SOURCE_REF: ${{ env.SYNTHETIC_0_2_0_SOURCE_REF }}");
    expect(updaterQa).toContain("-SyntheticSourceRef $env:SYNTHETIC_SOURCE_REF");
  });
});
