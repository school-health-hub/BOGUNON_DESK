import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(import.meta.dirname, "qa", "windows-updater-compatibility.ps1");
const tauriConfigPath = resolve(import.meta.dirname, "..", "src-tauri", "tauri.conf.json");
const execFileAsync = promisify(execFile);

describe("synthetic updater compatibility QA script", () => {
  it("records the required synthetic QA limitation labels", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain("UPGRADE_QA_MODE = SYNTHETIC_0_2_0_ENDPOINT_OVERLAY");
    expect(source).toContain("production 0.2.0 exact installer bytes: NOT TESTED");
    expect(source).toContain("updater protocol/signature/install compatibility: $($script:Summary.updaterProtocolSignatureInstallCompatibility)");
    expect(source).toContain("production 0.2.1 candidate bytes: $($script:Summary.production021CandidateBytes)");
    expect(source).toContain('$script:Summary.updaterProtocolSignatureInstallCompatibility = "TESTED"');
    expect(source).toContain('$script:Summary.production021CandidateBytes = "EXACT BYTES TESTED"');
  });

  it("uses the 0.2.0 source baseline and overlays only the synthetic updater endpoint", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain("2de999ac3bfc6ffec738634866780ab72ddb6d41");
    expect(source).toContain("$config.plugins.updater.endpoints = @($CandidateLatestUrl)");
    expect(source).toContain("Synthetic updater public key unchanged");
    expect(source).toContain("Synthetic updater install mode unchanged");
    expect(source).toContain("Candidate manifest endpoint namespace");
    expect(source).toContain("$escapedExpectedVersion = [regex]::Escape($ExpectedProductVersion)");
    expect(source).not.toContain("candidate/0\\.2\\.1");
    expect(source).toContain("No stale candidate version before update");
    expect(source).toContain("Updated app launch");
    expect(source).toContain("Updated app relaunch");
    expect(source).toContain("Non-sensitive setting persistence");
    expect(source).toContain("Production candidate signature present");
  });

  it("validates the remote candidate manifest, remote installer bytes, and remote signature before updater launch", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain("Remote candidate manifest version");
    expect(source).toContain("Remote candidate manifest installer URL");
    expect(source).toContain("Remote candidate manifest signature");
    expect(source).toContain("Remote candidate installer SHA-256");
    expect(source).toContain("Remote candidate signature SHA-256");
    expect(source).toContain("$expectedCandidateInstallerUrl = \"$candidatePrefixUrl/$($candidate.Name)\"");
    expect(source).toContain("Invoke-WebRequest -Uri $candidatePlatform.url -OutFile $remoteCandidatePath");
    expect(source).toContain("Invoke-WebRequest -Uri \"$($candidatePlatform.url).sig\" -OutFile $remoteSignaturePath");
  });

  it("does not expose candidate endpoint selection in production Tauri config", async () => {
    const config = await readFile(tauriConfigPath, "utf8");
    expect(config).not.toContain("candidate/");
    expect(config).not.toContain("SYNTHETIC_0_2_0_ENDPOINT_OVERLAY");
  });

  it("prefers the Windows npm command shim and preserves process execution contracts", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain('Get-Command "npm.cmd" -CommandType Application -ErrorAction SilentlyContinue');
    expect(source).toContain('Get-Command "npm.exe" -CommandType Application -ErrorAction Stop');
    expect(source).toContain('Invoke-CheckedProcess -FilePath $npmCommand -ArgumentList @("ci")');
    expect(source).toContain('Invoke-CheckedProcess -FilePath $npmCommand -ArgumentList @("run", "release:windows")');
  });

  it.runIf(process.platform === "win32")("executes the production launcher functions with a runner-shaped npm shim", async () => {
    const fixtureRoot = await mkdtemp(resolve(tmpdir(), "bogunon-npm-launcher-"));
    const shimRoot = resolve(fixtureRoot, "node");
    const workingDirectory = resolve(fixtureRoot, "synthetic source");
    const shimLog = resolve(fixtureRoot, "shim.log");
    const harnessPath = resolve(fixtureRoot, "harness.ps1");

    try {
      await Promise.all([mkdir(shimRoot, { recursive: true }), mkdir(workingDirectory, { recursive: true })]);
      await Promise.all([
        writeFile(resolve(shimRoot, "npm"), "#!/bin/sh\necho POSIX_SHIM_SHOULD_NOT_RUN\n"),
        writeFile(
          resolve(shimRoot, "npm.cmd"),
          '@echo off\r\necho SHIM_STDOUT %*\r\necho %CD%^|%*>>"%SHIM_LOG%"\r\nif "%1"=="fail" exit /b 7\r\nexit /b 0\r\n',
        ),
        writeFile(
          harnessPath,
          String.raw`param([string]$SourcePath, [string]$ShimRoot, [string]$WorkingDirectory, [string]$ShimLog)
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($SourcePath, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw "Production script parse failed." }
foreach ($functionName in @("Resolve-NpmCommand", "Invoke-CheckedProcess")) {
  $definition = $ast.FindAll({
    param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $functionName
  }, $true) | Select-Object -First 1
  if ($null -eq $definition) { throw "Missing production function: $functionName" }
  Invoke-Expression $definition.Extent.Text
}
function Write-QaLog {
  param([string]$Level, [string]$Message)
  Write-Output "[$Level] $Message"
}
$env:PATH = "$ShimRoot;$env:PATH"
$env:SHIM_LOG = $ShimLog
$npmCommand = Resolve-NpmCommand
if ([IO.Path]::GetFileName($npmCommand) -ne "npm.cmd") { throw "npm.cmd was not preferred." }
$failed = $false
try {
  Invoke-CheckedProcess -FilePath $npmCommand -ArgumentList @("fail") -WorkingDirectory $WorkingDirectory
} catch {
  $failed = $_.Exception.Message -match "exited with code 7"
}
if (-not $failed) { throw "Non-zero npm exit did not hard fail." }
`,
        ),
      ]);

      const { stdout } = await execFileAsync("powershell.exe", [
        "-NoLogo",
        "-NoProfile",
        "-File",
        harnessPath,
        "-SourcePath",
        scriptPath,
        "-ShimRoot",
        shimRoot,
        "-WorkingDirectory",
        workingDirectory,
        "-ShimLog",
        shimLog,
      ]);
      const invocations = await readFile(shimLog, "utf8");

      expect(stdout).toContain("SHIM_STDOUT fail");
      expect(invocations).toContain(`${workingDirectory}|fail`);
      expect(invocations).not.toContain("POSIX_SHIM_SHOULD_NOT_RUN");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
