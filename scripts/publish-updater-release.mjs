import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  POINTER_CACHE_CONTROL,
  RELEASE_BUCKET,
  RELEASE_PROJECT_REF,
  RELEASE_PUBLIC_BASE_URL,
  ReleasePublishError,
  CANDIDATE_CACHE_CONTROL,
  compareReleaseVersions,
  createCandidateBundle,
  loadReleaseBundle,
  validateReleaseTarget,
} from "./updater-release-publisher-contract.mjs";
import {
  defaultSleep,
  deleteObject,
  ensureImmutableObject,
  fetchPublicObject,
  uploadObject,
  verifyExactRemoteObject,
  verifyRemoteObjectAbsent,
} from "./updater-release-storage.mjs";

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishEvidenceDirectory = resolve(defaultProjectRoot, "artifacts", "release-candidate");

const evidenceModeName = (mode) => mode.replace(/[^0-9A-Za-z_.-]/gu, "_");
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

const writePublishEvidence = async ({ mode, status, result = null, error = null }) => {
  await mkdir(publishEvidenceDirectory, { recursive: true });
  const evidence = {
    status,
    mode,
    version: result?.version ?? process.env.RELEASE_VERSION ?? null,
    sourceSha: process.env.GITHUB_SHA ?? "local",
    workflowRunId: process.env.GITHUB_RUN_ID ?? "local",
    workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "local",
    installerUrl: result?.installerUrl ?? null,
    latestUrl: result?.latestUrl ?? null,
    sha256: result?.sha256 ?? null,
    bytes: result?.bytes ?? null,
    candidateCleanupVerified: result?.candidateCleanupVerified ?? null,
    errorCode: error instanceof ReleasePublishError ? error.code : null,
    errorMessage: error instanceof ReleasePublishError ? error.message : (error === null ? null : "updater release 게시에 실패했습니다."),
  };
  await writeFile(
    resolve(publishEvidenceDirectory, `publish-${evidenceModeName(mode)}-evidence.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
};

const loadTrustedBundle = async ({ projectRoot, version, credential, requireCredential = true }) => {
  validateReleaseTarget({ projectRef: RELEASE_PROJECT_REF, bucket: RELEASE_BUCKET, publicBaseUrl: RELEASE_PUBLIC_BASE_URL });
  if (requireCredential && (typeof credential !== "string" || credential.trim() === "")) {
    throw new ReleasePublishError("missing-storage-credential", "protected release Storage credential이 설정되지 않았습니다.");
  }
  return loadReleaseBundle({ projectRoot, version });
};

const assertPublicLatestCanPromote = async ({ fetchImpl, version, latest }) => {
  const existing = await fetchPublicObject({ fetchImpl, objectPath: "latest.json" });
  if (existing === null) return "absent";
  let existingLatest;
  try {
    existingLatest = JSON.parse(existing.toString("utf8"));
  } catch {
    throw new ReleasePublishError("invalid-public-latest", "public latest version을 안전하게 판별할 수 없어 승격을 중단했습니다.");
  }
  if (typeof existingLatest.version !== "string" || !semverPattern.test(existingLatest.version)) {
    throw new ReleasePublishError("invalid-public-latest", "public latest version을 안전하게 판별할 수 없어 승격을 중단했습니다.");
  }
  const comparison = compareReleaseVersions(existingLatest.version, version);
  if (comparison > 0) throw new ReleasePublishError("newer-latest-exists", "public latest가 요청 release보다 최신이라 승격을 중단했습니다.");
  if (comparison === 0 && !existing.equals(latest.contents)) {
    throw new ReleasePublishError("latest-pointer-conflict", "같은 version의 public latest 내용이 달라 승격을 중단했습니다.");
  }
  return comparison === 0 ? "existing" : "older";
};

export const publishCandidateRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  runId,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  const bundle = await loadTrustedBundle({ projectRoot, version, credential });
  const candidate = createCandidateBundle({ bundle, runId });
  const results = [];
  for (const artifact of candidate.artifacts) {
    results.push(await ensureImmutableObject({ fetchImpl, credential, artifact, cacheControl: CANDIDATE_CACHE_CONTROL }));
  }
  for (const artifact of candidate.artifacts) {
    await verifyExactRemoteObject({ fetchImpl, artifact, sleepImpl });
  }
  return { version: bundle.version, installerUrl: candidate.installerUrl, latestUrl: candidate.latestUrl, sha256: bundle.installer.sha256, bytes: bundle.installer.bytes, results };
};

export const publishVersionedRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  credential,
  fetchImpl = fetch,
}) => {
  const bundle = await loadTrustedBundle({ projectRoot, version, credential });
  const versionedResults = [];
  for (const artifact of bundle.versioned) {
    versionedResults.push(await ensureImmutableObject({ fetchImpl, credential, artifact }));
  }
  return { version: bundle.version, installerUrl: bundle.installerUrl, sha256: bundle.installer.sha256, bytes: bundle.installer.bytes, versionedResults };
};

export const verifyVersionedRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  const bundle = await loadTrustedBundle({ projectRoot, version, credential, requireCredential: false });
  for (const artifact of bundle.versioned) {
    await verifyExactRemoteObject({ fetchImpl, artifact, sleepImpl });
  }
  return { version: bundle.version, installerUrl: bundle.installerUrl, sha256: bundle.installer.sha256 };
};

export const publishReleaseMetadata = async ({
  projectRoot = defaultProjectRoot,
  version,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  const bundle = await loadTrustedBundle({ projectRoot, version, credential });
  const metadata = bundle.pointers.find((artifact) => artifact.objectPath === "release-metadata.json");
  const latest = bundle.pointers.find((artifact) => artifact.objectPath === "latest.json");
  if (metadata === undefined) throw new ReleasePublishError("invalid-release-output", "release metadata pointer를 확인할 수 없습니다.");
  if (latest === undefined) throw new ReleasePublishError("invalid-release-output", "latest pointer를 확인할 수 없습니다.");
  await assertPublicLatestCanPromote({ fetchImpl, version, latest });
  await uploadObject({ fetchImpl, credential, artifact: metadata, upsert: true, cacheControl: POINTER_CACHE_CONTROL });
  await verifyExactRemoteObject({ fetchImpl, artifact: metadata, sleepImpl });
  return { version: bundle.version, installerUrl: bundle.installerUrl, sha256: bundle.installer.sha256 };
};

export const promoteLatestRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  const bundle = await loadTrustedBundle({ projectRoot, version, credential });
  const latest = bundle.pointers.find((artifact) => artifact.objectPath === "latest.json");
  if (latest === undefined) throw new ReleasePublishError("invalid-release-output", "latest pointer를 확인할 수 없습니다.");
  if (await assertPublicLatestCanPromote({ fetchImpl, version, latest }) === "existing") {
    return { version: bundle.version, installerUrl: bundle.installerUrl, sha256: bundle.installer.sha256, status: "existing" };
  }
  await uploadObject({ fetchImpl, credential, artifact: latest, upsert: true, cacheControl: POINTER_CACHE_CONTROL });
  await verifyExactRemoteObject({ fetchImpl, artifact: latest, sleepImpl });
  return { version: bundle.version, installerUrl: bundle.installerUrl, sha256: bundle.installer.sha256, status: "promoted" };
};

export const verifyPublicLatestRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  const bundle = await loadTrustedBundle({ projectRoot, version, credential, requireCredential: false });
  const latest = bundle.pointers.find((artifact) => artifact.objectPath === "latest.json");
  if (latest === undefined) throw new ReleasePublishError("invalid-release-output", "latest pointer를 확인할 수 없습니다.");
  await verifyExactRemoteObject({ fetchImpl, artifact: latest, sleepImpl });
  return { version: bundle.version, installerUrl: bundle.installerUrl, sha256: bundle.installer.sha256 };
};

export const cleanupCandidateRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  runId,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  const bundle = await loadTrustedBundle({ projectRoot, version, credential });
  const candidate = createCandidateBundle({ bundle, runId });
  const results = [];
  for (const artifact of candidate.artifacts) {
    await deleteObject({ fetchImpl, credential, artifact });
    results.push("deleted-or-absent");
  }
  for (const artifact of candidate.artifacts) {
    await verifyRemoteObjectAbsent({ fetchImpl, artifact, sleepImpl });
  }
  return { version: bundle.version, installerUrl: candidate.installerUrl, latestUrl: candidate.latestUrl, sha256: bundle.installer.sha256, candidateCleanupVerified: true, results };
};

export const publishUpdaterRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  const versioned = await publishVersionedRelease({ projectRoot, version, credential, fetchImpl });
  await verifyVersionedRelease({ projectRoot, version, credential, fetchImpl, sleepImpl });
  await publishReleaseMetadata({ projectRoot, version, credential, fetchImpl, sleepImpl });
  await promoteLatestRelease({ projectRoot, version, credential, fetchImpl, sleepImpl });
  return versioned;
};

const run = async () => {
  const options = {
    version: process.env.RELEASE_VERSION ?? "",
    credential: process.env.SUPABASE_RELEASE_STORAGE_KEY,
    runId: process.env.RELEASE_CANDIDATE_RUN_ID,
  };
  const mode = process.env.RELEASE_PUBLISH_MODE ?? "all";
  const result = mode === "candidate"
    ? await publishCandidateRelease(options)
    : mode === "cleanup-candidate"
      ? await cleanupCandidateRelease(options)
    : mode === "versioned"
      ? await publishVersionedRelease(options)
      : mode === "verify-versioned"
        ? await verifyVersionedRelease(options)
        : mode === "metadata"
          ? await publishReleaseMetadata(options)
          : mode === "latest"
            ? await promoteLatestRelease(options)
            : mode === "verify-latest"
              ? await verifyPublicLatestRelease(options)
              : await publishUpdaterRelease(options);
  await writePublishEvidence({ mode, status: "passed", result });
  process.stdout.write(`[release:publish] BOGUNON DESK ${result.version} published and verified.\n`);
  process.stdout.write(`[release:publish] installer ${result.installerUrl}\n`);
  if ("latestUrl" in result) process.stdout.write(`[release:publish] candidate latest ${result.latestUrl}\n`);
  process.stdout.write(`[release:publish] SHA256 ${result.sha256}\n`);
  if ("bytes" in result) process.stdout.write(`[release:publish] bytes ${result.bytes}\n`);
};

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  run().catch((error) => {
    const message = error instanceof ReleasePublishError ? error.message : "updater release 게시에 실패했습니다.";
    writePublishEvidence({ mode: process.env.RELEASE_PUBLISH_MODE ?? "all", status: "failed", error })
      .catch(() => {})
      .finally(() => {
        process.stderr.write(`[release:publish] ${message}\n`);
        process.exitCode = 1;
      });
  });
}
