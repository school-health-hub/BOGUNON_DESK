import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectReleaseArtifacts } from "./collect-release-artifacts.mjs";

const version = "0.1.0";
const publishedAt = "2026-09-29T05:00:00.000Z";
const installerName = "source-setup.exe";
const signature = "fixture-signature-not-a-production-secret";

const createFixture = async ({ installers = [[installerName, "synthetic-installer"]], signatures = [], stale = [] } = {}) => {
  const root = await mkdtemp(join(tmpdir(), "bogunon-desk-release-"));
  const nsis = join(root, "src-tauri", "target", "x86_64-pc-windows-msvc", "release", "bundle", "nsis");
  await mkdir(nsis, { recursive: true });
  await Promise.all([
    ...installers.map(([name, contents]) => writeFile(join(nsis, name), contents)),
    ...signatures.map(([name, contents]) => writeFile(join(nsis, name), contents)),
  ]);
  await mkdir(join(root, "release"), { recursive: true });
  await writeFile(join(root, "release", "release-notes.json"), JSON.stringify({ notes: ["fixture release note"] }));
  if (stale.length > 0) {
    const output = join(root, "release-output");
    await mkdir(output, { recursive: true });
    await Promise.all(stale.map(([name, contents]) => writeFile(join(output, name), contents)));
  }
  return { root };
};

describe("release artifact collection", () => {
  it("preserves the exact normal QA output contract without signing environment or artifact", async () => {
    const contents = Buffer.from("synthetic-installer");
    const { root } = await createFixture({ installers: [[installerName, contents]] });
    const result = await collectReleaseArtifacts({ projectRoot: root, version });
    const expectedName = "BOGUNON-DESK-0.1.0-Windows-x64-Setup.exe";
    expect(result.fileName).toBe(expectedName);
    expect(result.sha256).toBe(createHash("sha256").update(contents).digest("hex"));
    expect(await readFile(join(root, "release-output", "SHA256SUMS.txt"), "utf8"))
      .toBe(`${result.sha256}  ${expectedName}\n`);
    const readmeFirst = await readFile(join(root, "release-output", "README-FIRST.txt"), "utf8");
    expect(readmeFirst).toContain("BOGUNON DESK 0.1.0 공유 베타");
    expect(readmeFirst).toContain("설치된 앱");
    expect(readmeFirst).toContain("%LOCALAPPDATA%\\kr.sungandi.schoolhealthdesk");
    expect(readmeFirst).toContain("완전 초기화");
    expect((await readdir(join(root, "release-output"))).sort()).toEqual([
      expectedName,
      "README-FIRST.txt",
      "SHA256SUMS.txt",
    ].sort());
    await expect(readFile(join(root, "release-output", "latest.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(root, "release-output", "release-metadata.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("collects one matching EXE and signature and generates both manifests", async () => {
    const contents = Buffer.from("synthetic-installer");
    const { root } = await createFixture({
      installers: [[installerName, contents]],
      signatures: [[`${installerName}.sig`, `${signature}\n`]],
    });
    const result = await collectReleaseArtifacts({ projectRoot: root, version, updater: true, publishedAt });
    const expectedName = "BOGUNON-DESK-0.1.0-Windows-x64-Setup.exe";
    const expectedSignatureName = `${expectedName}.sig`;
    expect(result).toMatchObject({ fileName: expectedName, signatureFileName: expectedSignatureName });
    const sums = await readFile(join(root, "release-output", "SHA256SUMS.txt"), "utf8");
    expect(sums).toContain(`${createHash("sha256").update(contents).digest("hex")}  ${expectedName}`);
    expect(sums).toContain(`  ${expectedSignatureName}\n`);
    const latest = JSON.parse(await readFile(join(root, "release-output", "latest.json"), "utf8"));
    expect(latest.platforms["windows-x86_64"].signature).toBe(signature);
    expect(latest.platforms["windows-x86_64"].url).toBe(
      `https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases/${version}/${expectedName}`,
    );
    const metadata = JSON.parse(await readFile(join(root, "release-output", "release-metadata.json"), "utf8"));
    expect(metadata).toMatchObject({ version, installerUrl: latest.platforms["windows-x86_64"].url, sha256: result.sha256, bytes: contents.length });
    expect(JSON.stringify({ latest, metadata })).not.toContain("fixture-private-key-value");
    const context = JSON.parse(await readFile(join(root, "artifacts", "release-candidate", "candidate-build-context.json"), "utf8"));
    const candidateLatest = JSON.parse(await readFile(join(root, "artifacts", "release-candidate", "candidate-latest.json"), "utf8"));
    const candidateMetadata = JSON.parse(await readFile(join(root, "artifacts", "release-candidate", "candidate-release-metadata.json"), "utf8"));
    expect(context).toMatchObject({
      version,
      sourceSha: "local",
      installer: { fileName: expectedName, sha256: result.sha256, bytes: contents.length },
      signature: { fileName: expectedSignatureName },
      upgradeQaMode: "SYNTHETIC_0_2_0_ENDPOINT_OVERLAY",
      production020ExactInstallerBytes: "NOT TESTED",
      updaterProtocolSignatureInstallCompatibility: "PENDING",
      production021CandidateBytes: "PENDING",
      exactByteCleanInstall: "PENDING",
    });
    expect(candidateLatest.platforms["windows-x86_64"].url).toBe(
      `https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases/candidate/${version}/local/${expectedName}`,
    );
    expect(candidateLatest.platforms["windows-x86_64"].signature).toBe(signature);
    expect(candidateMetadata).toMatchObject({
      version,
      installerUrl: candidateLatest.platforms["windows-x86_64"].url,
      candidate: {
        runId: "local",
        upgradeQaMode: "SYNTHETIC_0_2_0_ENDPOINT_OVERLAY",
        production020ExactInstallerBytes: "NOT TESTED",
        updaterProtocolSignatureInstallCompatibility: "PENDING",
        production021CandidateBytes: "PENDING",
        exactByteCleanInstall: "PENDING",
      },
    });
    expect(JSON.stringify(context)).not.toMatch(/TAURI_SIGNING_PRIVATE_KEY|SUPABASE_RELEASE_STORAGE_KEY|bearer|authorization|OAuth|DPAPI|private key/iu);
    expect(JSON.stringify({ candidateLatest, candidateMetadata })).not.toMatch(/TAURI_SIGNING_PRIVATE_KEY|SUPABASE_RELEASE_STORAGE_KEY|bearer|authorization|OAuth|DPAPI|private key/iu);
  });

  it.each([
    ["EXE without signature", { signatures: [] }, "signature 후보가 1개가 아닙니다"],
    ["signature without EXE", { installers: [], signatures: [[`${installerName}.sig`, signature]] }, "installer 후보가 1개가 아닙니다"],
    ["two EXEs", { installers: [["one.exe", "one"], ["two.exe", "two"]], signatures: [["one.exe.sig", signature]] }, "installer 후보가 1개가 아닙니다"],
    ["two signatures", { signatures: [[`${installerName}.sig`, signature], ["other.exe.sig", signature]] }, "signature 후보가 1개가 아닙니다"],
    ["mismatched stem", { signatures: [["other.exe.sig", signature]] }, "파일명이 일치하지 않습니다"],
    ["empty installer", { installers: [[installerName, ""]], signatures: [[`${installerName}.sig`, signature]] }, "installer가 비어 있습니다"],
    ["empty signature", { signatures: [[`${installerName}.sig`, "  \n"]] }, "signature가 비어 있습니다"],
  ])("rejects %s", async (_label, fixture, message) => {
    const { root } = await createFixture(fixture);
    await expect(collectReleaseArtifacts({ projectRoot: root, version, updater: true, publishedAt })).rejects.toThrow(message);
  });

  it("fails instead of guessing when multiple normal installer candidates exist", async () => {
    const { root } = await createFixture({ installers: [["one.exe", "one"], ["two.exe", "two"]] });
    await expect(collectReleaseArtifacts({ projectRoot: root, version })).rejects.toThrow("installer 후보가 1개가 아닙니다");
  });

  it.each([false, true])("rejects stale release-output in updater=%s mode", async (updater) => {
    const { root } = await createFixture({
      signatures: updater ? [[`${installerName}.sig`, signature]] : [],
      stale: [["BOGUNON-DESK-0.0.9-Windows-x64-Setup.exe", "stale"]],
    });
    await expect(collectReleaseArtifacts({ projectRoot: root, version, updater, publishedAt: updater ? publishedAt : undefined }))
      .rejects.toThrow("release contract 외의 파일");
  });

  it("uses the workflow run id, not the run attempt, as the stable candidate identity", async () => {
    const previousRunId = process.env.GITHUB_RUN_ID;
    const previousRunAttempt = process.env.GITHUB_RUN_ATTEMPT;
    process.env.GITHUB_RUN_ID = "123456789";
    process.env.GITHUB_RUN_ATTEMPT = "7";
    try {
      const { root } = await createFixture({
        installers: [[installerName, "synthetic-installer"]],
        signatures: [[`${installerName}.sig`, `${signature}\n`]],
      });
      await collectReleaseArtifacts({ projectRoot: root, version, updater: true, publishedAt });
      const candidateLatest = JSON.parse(await readFile(join(root, "artifacts", "release-candidate", "candidate-latest.json"), "utf8"));
      expect(candidateLatest.platforms["windows-x86_64"].url).toContain(`/candidate/${version}/123456789/`);
      expect(candidateLatest.platforms["windows-x86_64"].url).not.toContain("123456789-7");
    } finally {
      if (previousRunId === undefined) {
        delete process.env.GITHUB_RUN_ID;
      } else {
        process.env.GITHUB_RUN_ID = previousRunId;
      }
      if (previousRunAttempt === undefined) {
        delete process.env.GITHUB_RUN_ATTEMPT;
      } else {
        process.env.GITHUB_RUN_ATTEMPT = previousRunAttempt;
      }
    }
  });
});
