import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (name) =>
  readFile(new URL(`../${name}`, import.meta.url), "utf8");

describe("MY FINANCE Windows isolation launcher", () => {
  it("uses per-executable HKLM WebView2 overrides only on an elevated disposable runner", async () => {
    const source = await read("scripts/qa/windows-my-finance-isolation.ps1");

    expect(source).toContain("RUNNER_ENVIRONMENT -ne 'github-hosted'");
    expect(source).toContain(
      "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge\\WebView2\\AdditionalBrowserArguments",
    );
    expect(source).toContain("[IO.Path]::GetFileName($Path)");
    expect(source).toContain("if($elevated)");
    expect(source).toContain("Set-CdpPolicy");
    expect(source).toContain("Assert-NoCompetingCdpPolicy");
    expect(source).toContain("@('*',$operatingId,$qaId)");
    expect(source).toContain("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS");
    expect(source).not.toMatch(/New-ItemProperty[^\n]+["']\*["']/u);
  });

  it("snapshots and restores the exact policy value on every launch failure path", async () => {
    const source = await read("scripts/qa/windows-my-finance-isolation.ps1");

    expect(source).toContain("Get-CdpPolicySnapshot");
    expect(source).toContain("GetValueKind");
    expect(source).toContain("Restore-CdpPolicy");
    expect(source).toMatch(
      /try\s*\{[\s\S]+Start-Process[\s\S]+\}\s*finally\s*\{[\s\S]+Restore-CdpPolicy/u,
    );
    expect(source).toContain("CDP policy restoration failed");
    expect(source).toContain("Isolation cleanup failed");
  });

  it("rejects concurrent runs and occupied ports before exposing CDP", async () => {
    const source = await read("scripts/qa/windows-my-finance-isolation.ps1");

    expect(source).toContain("[Threading.Mutex]");
    expect(source).toContain("WaitOne(0)");
    expect(source).toContain("Assert-CdpPortAvailable");
    expect(source).toContain("Wait-CdpListener");
    expect(source).toContain("Assert-CdpPortClosed");
    expect(source).toContain("CDP listener was not owned by the launched app tree");
  });

  it("does not permanently embed the debugging switch in either installer", async () => {
    const production = JSON.parse(await read("src-tauri/tauri.conf.json"));
    const qa = JSON.parse(await read("src-tauri/tauri.my-finance-qa.conf.json"));

    expect(JSON.stringify(production)).not.toContain("remote-debugging-port");
    expect(JSON.stringify(qa)).not.toContain("remote-debugging-port");
    expect(production.app.windows[0].additionalBrowserArgs).toBeUndefined();
    expect(qa.app.windows[0].additionalBrowserArgs).toBeUndefined();
  });

  it("keeps automated isolation evidence after successful isolation", async () => {
    const workflow = await read(".github/workflows/my-finance-qa-windows.yml");
    const isolation = workflow.indexOf("windows-my-finance-isolation.ps1");
    const evidence = workflow.indexOf(
      "- name: Upload isolation evidence (not an installer)",
    );

    expect(isolation).toBeGreaterThan(-1);
    expect(evidence).toBeGreaterThan(isolation);
    expect(workflow.slice(isolation, evidence)).not.toContain("continue-on-error: true");
    expect(workflow.slice(evidence)).toContain("if: always()");
    expect(workflow.slice(evidence)).toContain(
      "path: artifacts/my-finance-qa-evidence/**",
    );
  });

  it("never publishes installable TESTABLE bytes from the automated QA workflow", async () => {
    const workflow = await read(".github/workflows/my-finance-qa-windows.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("pull_request:");
    expect(workflow).not.toContain("node scripts/package-my-finance-qa.mjs");
    expect(workflow).not.toContain("MY-FINANCE-QA-TESTABLE");
    expect(workflow).not.toContain("artifacts/my-finance-qa-ready");
    expect(workflow.match(/actions\/upload-artifact@/g)).toHaveLength(1);
  });

  it("reserves every TESTABLE publisher for the approved main workflow", async () => {
    const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
    const workflowFiles = (await readdir(workflowDirectory)).filter((name) =>
      /\.ya?ml$/u.test(name),
    );
    const publishers = [];

    for (const name of workflowFiles) {
      const source = await read(`.github/workflows/${name}`);
      const namesTestableOutput =
        source.includes("node scripts/package-my-finance-qa.mjs") ||
        source.includes("MY-FINANCE-QA-TESTABLE");
      const uploadsInstallableQaBytes =
        source.includes("qa:finance:windows") &&
        source
          .split(/\n(?=\s+- name: )/u)
          .filter((step) => step.includes("actions/upload-artifact@"))
          .some((step) =>
            /(?:\.exe|my-finance-qa-ready|bundle\/nsis|release-output)/u.test(step),
          );

      if (namesTestableOutput || uploadsInstallableQaBytes) {
        publishers.push(name);
      }
    }

    expect(publishers).toEqual(
      workflowFiles.includes("my-finance-qa-testable.yml")
        ? ["my-finance-qa-testable.yml"]
        : [],
    );
  });
});
