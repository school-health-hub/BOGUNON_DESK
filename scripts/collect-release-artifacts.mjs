import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateUpdaterDocuments } from "./generate-updater-manifest.mjs";

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const windowsTarget = "x86_64-pc-windows-msvc";
const publicReleaseBaseUrl = "https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases";

const readmeFirst = (version, updater) => `BOGUNON DESK ${version} 공유 베타

보건교사를 위한 Windows 데스크톱 워크스페이스입니다.

지원 환경:
Windows 10/11 x64

핵심 안내:
- 학생 건강기록 시스템이 아닙니다.
- BOGUNON 계정 연결 없이도 일부 로컬 도구를 사용할 수 있습니다.
- 품의 및 공문 파일은 기본적으로 로컬에서 처리합니다.
- AI API Key는 앱을 완전히 종료하면 사라집니다.
- 베타 버전이므로 중요한 원본 파일은 별도로 보관해 주세요.
${updater ? "- 이 build는 updater infrastructure를 지원하며, update availability는 공식 release channel 상태에 따릅니다.\n" : ""}
제거:
- Windows 설정 → 앱 → 설치된 앱 → BOGUNON DESK → 제거
- 제거 후에도 %LOCALAPPDATA%\\kr.sungandi.schoolhealthdesk의 로컬 설정과 로그인/session 데이터가 남을 수 있습니다.
- 완전 초기화를 원하면 앱 제거 후 해당 폴더를 직접 삭제하세요.

이 공유 베타는 아직 코드서명되지 않아 Windows에서 게시자 확인 경고가 표시될 수 있습니다.
`;

const sha256File = async (path) => new Promise((resolveHash, rejectHash) => {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  stream.on("error", rejectHash);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("end", () => resolveHash(hash.digest("hex")));
});

const selectSourceArtifacts = async (nsisDirectory, updater) => {
  const entries = (await readdir(nsisDirectory, { withFileTypes: true })).filter((entry) => entry.isFile());
  const installers = entries.filter((entry) => entry.name.toLowerCase().endsWith(".exe"));
  if (installers.length !== 1) throw new Error(`NSIS installer 후보가 1개가 아닙니다. 발견: ${installers.length}개`);
  if (!updater) return { installerName: installers[0].name, signatureName: null };
  const signatures = entries.filter((entry) => entry.name.toLowerCase().endsWith(".exe.sig"));
  if (signatures.length !== 1) throw new Error(`NSIS updater signature 후보가 1개가 아닙니다. 발견: ${signatures.length}개`);
  if (signatures[0].name !== `${installers[0].name}.sig`) throw new Error("NSIS installer와 updater signature 파일명이 일치하지 않습니다.");
  return { installerName: installers[0].name, signatureName: signatures[0].name };
};

const assertCleanOutput = async (outputDirectory, expectedNames) => {
  await mkdir(outputDirectory, { recursive: true });
  const unexpected = (await readdir(outputDirectory, { withFileTypes: true }))
    .filter((entry) => !entry.isFile() || !expectedNames.has(entry.name));
  if (unexpected.length > 0) throw new Error("release-output에 현재 release contract 외의 파일이 있습니다. 별도로 보관한 뒤 다시 실행해 주세요.");
};

export const collectReleaseArtifacts = async ({ projectRoot = defaultProjectRoot, version, updater = false, publishedAt }) => {
  const nsisDirectory = join(projectRoot, "src-tauri", "target", windowsTarget, "release", "bundle", "nsis");
  const source = await selectSourceArtifacts(nsisDirectory, updater);
  const installerSourcePath = join(nsisDirectory, source.installerName);
  const installerSourceStat = await stat(installerSourcePath);
  if (installerSourceStat.size === 0) throw new Error("NSIS installer가 비어 있습니다.");
  const signatureSourcePath = source.signatureName === null ? null : join(nsisDirectory, source.signatureName);
  const signature = signatureSourcePath === null ? null : (await readFile(signatureSourcePath, "utf8")).trim();
  if (updater && signature === "") throw new Error("NSIS updater signature가 비어 있습니다.");
  const fileName = `BOGUNON-DESK-${version}-Windows-x64-Setup.exe`;
  const signatureFileName = `${fileName}.sig`;
  const outputDirectory = join(projectRoot, "release-output");
  const expectedNames = new Set(updater
    ? [fileName, signatureFileName, "SHA256SUMS.txt", "README-FIRST.txt", "latest.json", "release-metadata.json"]
    : [fileName, "SHA256SUMS.txt", "README-FIRST.txt"]);
  await assertCleanOutput(outputDirectory, expectedNames);
  const outputPath = join(outputDirectory, fileName);
  await copyFile(installerSourcePath, outputPath);
  const installerSha256 = await sha256File(outputPath);
  const installerStat = await stat(outputPath);
  const checksums = [`${installerSha256}  ${fileName}`];

  if (!updater || source.signatureName === null) {
    await Promise.all([
      writeFile(join(outputDirectory, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`, "utf8"),
      writeFile(join(outputDirectory, "README-FIRST.txt"), readmeFirst(version, false), "utf8"),
    ]);
    return { fileName, bytes: installerStat.size, sha256: installerSha256 };
  }

  if (signatureSourcePath === null || signature === null) throw new Error("NSIS updater signature를 확인할 수 없습니다.");
  const signatureOutputPath = join(outputDirectory, signatureFileName);
  await copyFile(signatureSourcePath, signatureOutputPath);
  const signatureSha256 = await sha256File(signatureOutputPath);
  checksums.push(`${signatureSha256}  ${signatureFileName}`);
  const releaseInput = JSON.parse(await readFile(join(projectRoot, "release", "release-notes.json"), "utf8"));
  const installerUrl = `${publicReleaseBaseUrl}/${version}/${fileName}`;
  const documents = generateUpdaterDocuments({ version, publishedAt, notes: releaseInput.notes, installerUrl, signature, sha256: installerSha256, bytes: installerStat.size });
  await Promise.all([
    writeFile(join(outputDirectory, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`, "utf8"),
    writeFile(join(outputDirectory, "README-FIRST.txt"), readmeFirst(version, true), "utf8"),
    writeFile(join(outputDirectory, "latest.json"), `${JSON.stringify(documents.latest, null, 2)}\n`, "utf8"),
    writeFile(join(outputDirectory, "release-metadata.json"), `${JSON.stringify(documents.metadata, null, 2)}\n`, "utf8"),
  ]);
  return { fileName, signatureFileName, bytes: installerStat.size, sha256: installerSha256 };
};

const run = async () => {
  const packageManifest = JSON.parse(await readFile(resolve(defaultProjectRoot, "package.json"), "utf8"));
  const version = typeof packageManifest.version === "string" ? packageManifest.version : "";
  if (version === "") throw new Error("package.json version을 확인할 수 없습니다.");
  const updater = process.argv.includes("--updater");
  const publishedAt = updater ? process.env.RELEASE_PUBLISHED_AT : undefined;
  if (updater && (publishedAt === undefined || publishedAt.trim() === "")) throw new Error("RELEASE_PUBLISHED_AT UTC RFC3339 값이 필요합니다.");
  const result = await collectReleaseArtifacts({ version, updater, publishedAt });
  process.stdout.write(`[release] ${result.fileName}\n[release] ${result.bytes} bytes\n[release] SHA256 ${result.sha256}\n`);
};

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : "release artifact 수집에 실패했습니다.";
    process.stderr.write(`[release] ${message}\n`);
    process.exitCode = 1;
  });
}
