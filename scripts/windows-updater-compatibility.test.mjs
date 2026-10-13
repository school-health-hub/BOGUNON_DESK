import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(import.meta.dirname, "qa", "windows-updater-compatibility.ps1");
const tauriConfigPath = resolve(import.meta.dirname, "..", "src-tauri", "tauri.conf.json");

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

  it("resolves a Windows npm command shim before launching synthetic build commands", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain('function Resolve-NpmCommand');
    expect(source).toContain('@("npm.cmd", "npm.exe")');
    expect(source).toContain('$npmCommandPath = Resolve-NpmCommand');
    expect(source).toContain('Invoke-CheckedProcess -FilePath $npmCommandPath -ArgumentList @("ci")');
    expect(source).toContain('Invoke-CheckedProcess -FilePath $npmCommandPath -ArgumentList @("run", "tauri", "build"');
    expect(source).not.toContain('Invoke-CheckedProcess -FilePath "npm"');
  });

  it("validates the untouched 0.2.0 source before applying the candidate endpoint overlay", async () => {
    const source = await readFile(scriptPath, "utf8");
    const testIndex = source.indexOf('Invoke-CheckedProcess -FilePath $npmCommandPath -ArgumentList @("test")');
    const overlayIndex = source.indexOf('Set-SyntheticUpdaterEndpoint -SourceDirectory $SyntheticSourceDirectory');
    const tauriBuildIndex = source.indexOf('Invoke-CheckedProcess -FilePath $npmCommandPath -ArgumentList @("run", "tauri", "build"');
    expect(testIndex).toBeGreaterThan(-1);
    expect(overlayIndex).toBeGreaterThan(testIndex);
    expect(tauriBuildIndex).toBeGreaterThan(overlayIndex);
    expect(source).not.toContain('ArgumentList @("run", "release:windows")');
  });

  it("searches the actual per-user install root as well as Program Files", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain("function Get-InstalledProductMatches");
    expect(source).toContain("$env:LOCALAPPDATA,");
    expect(source).toContain('$env:ProgramFiles,');
    expect(source).toContain('${env:ProgramFiles(x86)}');
    expect(source).not.toContain('$env:LOCALAPPDATA\\Programs", "$env:ProgramFiles');
  });

  it("stops the updater-owned app before verifying a fresh updated launch", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain('Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue');
    expect(source).toContain('Stopped updater-owned app process $($app.Id) before fresh launch verification.');
    const stopIndex = source.indexOf('Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue');
    const launchIndex = source.indexOf('Start-AppAndStop -Executable $updatedExecutable -Label "Updated app launch"');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(launchIndex).toBeGreaterThan(stopIndex);
  });

  it("stops any updater-restarted single instance before fresh launch verification", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toContain('function Stop-RunningProductProcesses');
    expect(source).toContain('Get-Process -Name "school-health-desk"');
    expect(source).toContain('Stop-RunningProductProcesses');
    const stopAllIndex = source.indexOf('Stop-RunningProductProcesses\n  Start-AppAndStop -Executable $updatedExecutable -Label "Updated app launch"');
    expect(stopAllIndex).toBeGreaterThan(-1);
  });

  it("does not expose candidate endpoint selection in production Tauri config", async () => {
    const config = await readFile(tauriConfigPath, "utf8");
    expect(config).not.toContain("candidate/");
    expect(config).not.toContain("SYNTHETIC_0_2_0_ENDPOINT_OVERLAY");
  });
});
