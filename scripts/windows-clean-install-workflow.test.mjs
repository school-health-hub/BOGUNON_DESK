import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(import.meta.dirname, "..", ".github", "workflows", "windows-clean-install-qa.yml");
const readWorkflow = () => readFile(workflowPath, "utf8");

describe("Windows clean-install QA workflow", () => {
  it("keeps the source-build path for PR smoke testing", async () => {
    const source = await readWorkflow();
    expect(source).toContain("pull_request:");
    expect(source).toContain("npm run release:windows");
    expect(source).toContain("inputs.candidate_artifact_name == ''");
  });

  it("supports exact-byte production candidate QA without rebuilding", async () => {
    const source = await readWorkflow();
    const downloadIndex = source.indexOf("Download production candidate artifact");
    const locateIndex = source.indexOf("Locate generated installer");
    const runIndex = source.indexOf("Run clean-install smoke test");
    expect(source).toContain("candidate_artifact_name:");
    expect(source).toContain("candidate_run_id:");
    expect(source).toContain("expected_sha256:");
    expect(source).toMatch(/permissions:\s*\n\s+contents: read\s*\n\s+actions: read/u);
    expect(source).toContain("run-id: ${{ inputs.candidate_run_id || github.run_id }}");
    expect(source).toContain("github-token: ${{ github.token }}");
    expect(source).toMatch(/actions\/download-artifact@/u);
    expect(downloadIndex).toBeLessThan(locateIndex);
    expect(locateIndex).toBeLessThan(runIndex);
    expect(source).toContain("-ExpectedSha256 $env:EXPECTED_SHA256");
    expect(source).toContain("-ExpectedProductVersion $env:EXPECTED_PRODUCT_VERSION");
    expect(source).not.toContain('-ExpectedSha256 "${{ inputs.expected_sha256 }}"');
  });
});
