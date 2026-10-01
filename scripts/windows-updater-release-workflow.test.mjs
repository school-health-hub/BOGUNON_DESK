import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(import.meta.dirname, "..", ".github", "workflows", "windows-updater-release.yml");
const readWorkflow = () => readFile(workflowPath, "utf8");
const workflowStep = (source, name) => {
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

  it("references production secrets only in the protected job and uses reviewed release commands", async () => {
    const source = await readWorkflow();
    const jobEnvironment = source.slice(source.indexOf("    env:"), source.indexOf("    steps:"));
    const buildStep = workflowStep(source, "Build and validate signed updater artifacts");
    const publishStep = workflowStep(source, "Publish and remotely verify updater release");
    const summaryStep = workflowStep(source, "Write sanitized release summary");

    expect(jobEnvironment).not.toMatch(/TAURI_SIGNING_PRIVATE_KEY|SUPABASE_RELEASE_STORAGE_KEY/u);
    expect(buildStep).toContain("TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}");
    expect(buildStep).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}");
    expect(buildStep).not.toContain("SUPABASE_RELEASE_STORAGE_KEY");
    expect(publishStep).toContain("SUPABASE_RELEASE_STORAGE_KEY: ${{ secrets.SUPABASE_RELEASE_STORAGE_KEY }}");
    expect(publishStep).not.toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(summaryStep).not.toMatch(/TAURI_SIGNING_PRIVATE_KEY|SUPABASE_RELEASE_STORAGE_KEY/u);
    expect(source).toContain("VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}");
    expect(source).toContain("VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}");
    expect(source.indexOf("npm run release:updater")).toBeLessThan(source.indexOf("npm run release:publish"));
    expect(source).not.toMatch(/gh release|git tag|create-release|contents: write/u);
  });
});
