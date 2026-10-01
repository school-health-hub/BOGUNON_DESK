import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  POINTER_CACHE_CONTROL,
  RELEASE_BUCKET,
  RELEASE_PROJECT_REF,
  RELEASE_PUBLIC_BASE_URL,
  RELEASE_STORAGE_OBJECT_URL,
  ReleasePublishError,
  VERSIONED_CACHE_CONTROL,
  loadReleaseBundle,
  validateReleaseTarget,
} from "./updater-release-publisher-contract.mjs";

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const contentTypeFor = (name) => {
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".txt") || name.endsWith(".sig")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
};

const encodeObjectPath = (path) => path.split("/").map(encodeURIComponent).join("/");
const publicUrl = (path, verificationKey) => {
  const base = `${RELEASE_PUBLIC_BASE_URL}/${encodeObjectPath(path)}`;
  const cacheKey = verificationKey === undefined ? "probe" : verificationKey;
  return `${base}?verify=${encodeURIComponent(cacheKey)}&nonce=${randomUUID()}`;
};
const objectUrl = (path) => `${RELEASE_STORAGE_OBJECT_URL}/${encodeObjectPath(path)}`;

const isMissingStorageResponse = async (response) => {
  if (response.status === 404) return true;
  if (response.status !== 400) return false;
  try {
    const payload = JSON.parse(await response.text());
    return payload.statusCode === "404" || payload.error === "not_found" || payload.error === "NotFound";
  } catch {
    return false;
  }
};

const fetchPublicObject = async ({ fetchImpl, objectPath, verificationKey }) => {
  let response;
  try {
    response = await fetchImpl(publicUrl(objectPath, verificationKey), { cache: "no-store" });
  } catch {
    throw new ReleasePublishError("release-network-failure", "release Storage에 연결하지 못했습니다.");
  }
  if (response.ok) return Buffer.from(await response.arrayBuffer());
  if (await isMissingStorageResponse(response)) return null;
  throw new ReleasePublishError("release-read-failure", "remote release artifact를 확인하지 못했습니다.");
};

const uploadObject = async ({ fetchImpl, credential, artifact, upsert, cacheControl }) => {
  let response;
  try {
    response = await fetchImpl(objectUrl(artifact.objectPath), {
      method: "POST",
      headers: {
        apikey: credential,
        "cache-control": cacheControl,
        "content-type": contentTypeFor(artifact.name),
        "x-upsert": upsert ? "true" : "false",
      },
      body: artifact.contents,
    });
  } catch {
    throw new ReleasePublishError("release-network-failure", "release artifact 업로드 요청에 실패했습니다.");
  }
  if (!response.ok) throw new ReleasePublishError("release-upload-failure", "release artifact를 업로드하지 못했습니다.");
};

const defaultSleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

const verifyExactRemoteObject = async ({ fetchImpl, artifact, sleepImpl }) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const remote = await fetchPublicObject({ fetchImpl, objectPath: artifact.objectPath, verificationKey: artifact.sha256 });
    if (remote !== null && remote.equals(artifact.contents)) return;
    if (attempt < 3) await sleepImpl(500 * (2 ** attempt));
  }
  throw new ReleasePublishError("release-verification-failure", "remote release artifact 검증에 실패했습니다.");
};

const ensureImmutableObject = async ({ fetchImpl, credential, artifact }) => {
  const existing = await fetchPublicObject({ fetchImpl, objectPath: artifact.objectPath });
  if (existing !== null) {
    if (!existing.equals(artifact.contents)) {
      throw new ReleasePublishError("immutable-release-conflict", "동일 version의 remote artifact 내용이 달라 게시를 중단했습니다.");
    }
    return "existing";
  }
  await uploadObject({ fetchImpl, credential, artifact, upsert: false, cacheControl: VERSIONED_CACHE_CONTROL });
  return "uploaded";
};

export const publishUpdaterRelease = async ({
  projectRoot = defaultProjectRoot,
  version,
  credential,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
}) => {
  validateReleaseTarget({ projectRef: RELEASE_PROJECT_REF, bucket: RELEASE_BUCKET, publicBaseUrl: RELEASE_PUBLIC_BASE_URL });
  if (typeof credential !== "string" || credential.trim() === "") {
    throw new ReleasePublishError("missing-storage-credential", "protected release Storage credential이 설정되지 않았습니다.");
  }
  const bundle = await loadReleaseBundle({ projectRoot, version });
  const versionedResults = [];
  for (const artifact of bundle.versioned) {
    versionedResults.push(await ensureImmutableObject({ fetchImpl, credential, artifact }));
  }
  for (const artifact of bundle.versioned) {
    await verifyExactRemoteObject({ fetchImpl, artifact, sleepImpl });
  }
  for (const pointer of bundle.pointers) {
    await uploadObject({ fetchImpl, credential, artifact: pointer, upsert: true, cacheControl: POINTER_CACHE_CONTROL });
    await verifyExactRemoteObject({ fetchImpl, artifact: pointer, sleepImpl });
  }
  return {
    version: bundle.version,
    installerUrl: bundle.installerUrl,
    sha256: bundle.installer.sha256,
    bytes: bundle.installer.bytes,
    versionedResults,
  };
};

const run = async () => {
  const result = await publishUpdaterRelease({
    version: process.env.RELEASE_VERSION ?? "",
    credential: process.env.SUPABASE_RELEASE_STORAGE_KEY,
  });
  process.stdout.write(`[release:publish] BOGUNON DESK ${result.version} published and verified.\n`);
  process.stdout.write(`[release:publish] installer ${result.installerUrl}\n`);
  process.stdout.write(`[release:publish] SHA256 ${result.sha256}\n`);
  process.stdout.write(`[release:publish] bytes ${result.bytes}\n`);
};

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  run().catch((error) => {
    const message = error instanceof ReleasePublishError ? error.message : "updater release 게시에 실패했습니다.";
    process.stderr.write(`[release:publish] ${message}\n`);
    process.exitCode = 1;
  });
}
