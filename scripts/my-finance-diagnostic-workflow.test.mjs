import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (name) =>
  readFile(new URL(`../${name}`, import.meta.url), "utf8");

describe("MY FINANCE trusted diagnostic workflow", () => {
  it("accepts no caller-controlled source ref and pins the approved QA commit", async () => {
    const workflow = await read(
      ".github/workflows/my-finance-qa-diagnostic.yml",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("inputs:");
    expect(workflow).toContain(
      "QA_SOURCE_SHA: f3f920d56045d24b8fc097ffcef224afd760a800",
    );
    expect(workflow).toContain(
      "OPERATING_REFERENCE_SHA: 5cec64358436c148710499b5aa9d2e78c34e0136",
    );
    expect(workflow).toContain("ref: ${{ env.QA_SOURCE_SHA }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("git rev-parse HEAD");
  });

  it("uses a serialized disposable Windows runner with read-only repository access", async () => {
    const workflow = await read(
      ".github/workflows/my-finance-qa-diagnostic.yml",
    );

    expect(workflow).toMatch(/permissions:\s+contents: read/u);
    expect(workflow).toContain("runs-on: windows-latest");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("timeout-minutes: 90");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).not.toMatch(/uses:\s+[^\s]+@(v|main|master)/u);
  });

  it("uploads diagnostic evidence only and has no TESTABLE publication path", async () => {
    const workflow = await read(
      ".github/workflows/my-finance-qa-diagnostic.yml",
    );

    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("artifacts/my-finance-qa-evidence/**");
    expect(workflow).not.toContain("package-my-finance-qa.mjs");
    expect(workflow).not.toContain("my-finance-qa-ready");
    expect(workflow).not.toContain("MY-FINANCE-QA-TESTABLE");
    expect(workflow).not.toContain("TESTABLE");
  });

  it("cannot publish a success artifact after failure or cancellation", async () => {
    const workflow = await read(
      ".github/workflows/my-finance-qa-diagnostic.yml",
    );

    expect(workflow).toContain("windows-my-finance-isolation.ps1");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("Upload diagnostic evidence only");
    expect(workflow.match(/uses:\s+actions\/upload-artifact@/gu)).toHaveLength(1);
    expect(workflow).not.toMatch(/if:\s+success\(\)/u);
  });
});
