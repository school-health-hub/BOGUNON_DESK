import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export const RELEASE_PROJECT_REF = "xxownwxxajzrviuvvfiu";
export const RELEASE_BUCKET = "desktop-releases";
export const RELEASE_PUBLIC_BASE_URL = `https://${RELEASE_PROJECT_REF}.supabase.co/storage/v1/object/public/${RELEASE_BUCKET}`;
export const RELEASE_STORAGE_OBJECT_URL = `https://${RELEASE_PROJECT_REF}.supabase.co/storage/v1/object/${RELEASE_BUCKET}`;
export const VERSIONED_CACHE_CONTROL = "max-age=31536000";
export const POINTER_CACHE_CONTROL = "max-age=300";
export const CANDIDATE_CACHE_CONTROL = "max-age=86400";
export const CANDIDATE_QA_PENDING_STATUS = "PENDING";

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");
const candidateRunIdPattern = /^[0-9A-Za-z_.-]+$/u;

export class ReleasePublishError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReleasePublishError";
    this.code = code;
  }
}

const parseJson = (contents, name) => {
  try {
    return JSON.parse(contents.toString("utf8"));
  } catch {
    throw new ReleasePublishError("invalid-release-output", `${name} 형식이 유효하지 않습니다.`);
  }
};

export const validateReleaseTarget = ({ projectRef, bucket, publicBaseUrl }) => {
  if (
    projectRef !== RELEASE_PROJECT_REF
    || bucket !== RELEASE_BUCKET
    || publicBaseUrl !== RELEASE_PUBLIC_BASE_URL
  ) {
    throw new ReleasePublishError("unsafe-release-target", "승인된 BOGUNON DESK release Storage 대상이 아닙니다.");
  }
};

export const compareReleaseVersions = (left, right) => {
  const parse = (value) => value.split(/[+-]/u)[0].split(".").map((part) => Number.parseInt(part, 10));
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = leftParts[index] - rightParts[index];
    if (diff !== 0) return diff;
  }
  return 0;
};

export const loadReleaseBundle = async ({ projectRoot, version }) => {
  if (!semverPattern.test(version)) {
    throw new ReleasePublishError("invalid-version", "release version이 유효한 SemVer가 아닙니다.");
  }
  const outputDirectory = join(projectRoot, "release-output");
  let packageVersion;
  try {
    packageVersion = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).version;
  } catch {
    throw new ReleasePublishError("invalid-version", "package.json version을 확인할 수 없습니다.");
  }
  if (packageVersion !== version) {
    throw new ReleasePublishError("invalid-version", "release version이 package.json version과 일치하지 않습니다.");
  }
  const installerName = `BOGUNON-DESK-${version}-Windows-x64-Setup.exe`;
  const signatureName = `${installerName}.sig`;
  const expectedNames = [installerName, signatureName, "SHA256SUMS.txt", "README-FIRST.txt", "latest.json", "release-metadata.json"];
  let actualNames;
  try {
    actualNames = (await readdir(outputDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch {
    throw new ReleasePublishError("missing-release-output", "release-output을 확인할 수 없습니다.");
  }
  if (JSON.stringify(actualNames) !== JSON.stringify([...expectedNames].sort())) {
    throw new ReleasePublishError("invalid-release-output", "release-output이 signed updater 6-file contract와 일치하지 않습니다.");
  }

  const entries = new Map();
  for (const name of expectedNames) {
    const path = join(outputDirectory, name);
    const [contents, fileStat] = await Promise.all([readFile(path), stat(path)]);
    if (fileStat.size === 0) throw new ReleasePublishError("empty-release-file", `${name} 파일이 비어 있습니다.`);
    entries.set(name, { name, contents, bytes: fileStat.size, sha256: sha256(contents) });
  }

  const installer = entries.get(installerName);
  const signature = entries.get(signatureName);
  const checksums = entries.get("SHA256SUMS.txt");
  const latestEntry = entries.get("latest.json");
  const metadataEntry = entries.get("release-metadata.json");
  if (installer === undefined || signature === undefined || checksums === undefined || latestEntry === undefined || metadataEntry === undefined) {
    throw new ReleasePublishError("invalid-release-output", "필수 release artifact를 확인할 수 없습니다.");
  }
  const latest = parseJson(latestEntry.contents, "latest.json");
  const metadata = parseJson(metadataEntry.contents, "release-metadata.json");
  const installerUrl = `${RELEASE_PUBLIC_BASE_URL}/${version}/${installerName}`;
  const platform = latest.platforms?.["windows-x86_64"];
  const signatureText = signature.contents.toString("utf8").trim();
  const expectedChecksums = `${installer.sha256}  ${installerName}\n${signature.sha256}  ${signatureName}\n`;
  if (checksums.contents.toString("utf8") !== expectedChecksums) {
    throw new ReleasePublishError("invalid-release-checksums", "SHA256SUMS.txt가 local installer/signature와 일치하지 않습니다.");
  }
  if (latest.version !== version || platform?.url !== installerUrl || platform?.signature !== signatureText || signatureText === "") {
    throw new ReleasePublishError("invalid-latest-manifest", "latest.json이 local installer/signature contract와 일치하지 않습니다.");
  }
  if (
    metadata.version !== version
    || metadata.installerUrl !== installerUrl
    || metadata.sha256 !== installer.sha256
    || metadata.bytes !== installer.bytes
  ) {
    throw new ReleasePublishError("invalid-release-metadata", "release-metadata.json이 local installer contract와 일치하지 않습니다.");
  }

  const versioned = [installerName, signatureName, "SHA256SUMS.txt", "README-FIRST.txt"]
    .map((name) => ({ ...entries.get(name), objectPath: `${version}/${name}` }));
  return {
    version,
    installer,
    installerUrl,
    signature,
    latestEntry,
    metadataEntry,
    versioned,
    pointers: [
      { ...metadataEntry, objectPath: "release-metadata.json" },
      { ...latestEntry, objectPath: "latest.json" },
    ],
  };
};

export const createCandidateBundle = ({ bundle, runId }) => {
  if (typeof runId !== "string" || !candidateRunIdPattern.test(runId)) {
    throw new ReleasePublishError("invalid-candidate-run-id", "candidate run id가 유효하지 않습니다.");
  }
  const prefix = `candidate/${bundle.version}/${runId}`;
  const candidateInstallerPath = `${prefix}/${bundle.installer.name}`;
  const candidateInstallerUrl = `${RELEASE_PUBLIC_BASE_URL}/${candidateInstallerPath}`;
  const latest = parseJson(bundle.latestEntry.contents, "latest.json");
  const metadata = parseJson(bundle.metadataEntry.contents, "release-metadata.json");
  latest.platforms["windows-x86_64"].url = candidateInstallerUrl;
  metadata.installerUrl = candidateInstallerUrl;
  metadata.candidate = {
    runId,
    upgradeQaMode: "SYNTHETIC_0_2_0_ENDPOINT_OVERLAY",
    production020ExactInstallerBytes: "NOT TESTED",
    updaterProtocolSignatureInstallCompatibility: CANDIDATE_QA_PENDING_STATUS,
    production021CandidateBytes: CANDIDATE_QA_PENDING_STATUS,
    exactByteCleanInstall: CANDIDATE_QA_PENDING_STATUS,
  };
  const candidateLatest = {
    ...bundle.latestEntry,
    name: "latest.json",
    contents: Buffer.from(`${JSON.stringify(latest, null, 2)}\n`),
    objectPath: `${prefix}/latest.json`,
  };
  candidateLatest.bytes = candidateLatest.contents.length;
  candidateLatest.sha256 = sha256(candidateLatest.contents);
  const candidateMetadata = {
    ...bundle.metadataEntry,
    name: "release-metadata.json",
    contents: Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`),
    objectPath: `${prefix}/release-metadata.json`,
  };
  candidateMetadata.bytes = candidateMetadata.contents.length;
  candidateMetadata.sha256 = sha256(candidateMetadata.contents);
  const artifacts = [
    ...bundle.versioned.map((artifact) => ({
      ...artifact,
      objectPath: `${prefix}/${artifact.name}`,
    })),
    candidateMetadata,
    candidateLatest,
  ];
  return {
    prefix,
    latestUrl: `${RELEASE_PUBLIC_BASE_URL}/${prefix}/latest.json`,
    installerUrl: candidateInstallerUrl,
    artifacts,
  };
};
