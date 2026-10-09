import { randomUUID } from "node:crypto";
import {
  RELEASE_PUBLIC_BASE_URL,
  RELEASE_STORAGE_OBJECT_URL,
  ReleasePublishError,
  VERSIONED_CACHE_CONTROL,
} from "./updater-release-publisher-contract.mjs";

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

export const defaultSleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

export const fetchPublicObject = async ({ fetchImpl, objectPath, verificationKey }) => {
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

export const uploadObject = async ({ fetchImpl, credential, artifact, upsert, cacheControl }) => {
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

export const deleteObject = async ({ fetchImpl, credential, artifact }) => {
  let response;
  try {
    response = await fetchImpl(objectUrl(artifact.objectPath), {
      method: "DELETE",
      headers: { apikey: credential },
    });
  } catch {
    throw new ReleasePublishError("release-network-failure", "candidate artifact cleanup 요청에 실패했습니다.");
  }
  if (!response.ok && !(await isMissingStorageResponse(response))) {
    throw new ReleasePublishError("release-cleanup-failure", "candidate artifact cleanup에 실패했습니다.");
  }
};

export const verifyExactRemoteObject = async ({ fetchImpl, artifact, sleepImpl }) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const remote = await fetchPublicObject({ fetchImpl, objectPath: artifact.objectPath, verificationKey: artifact.sha256 });
    if (remote !== null && remote.equals(artifact.contents)) return;
    if (attempt < 3) await sleepImpl(500 * (2 ** attempt));
  }
  throw new ReleasePublishError("release-verification-failure", "remote release artifact 검증에 실패했습니다.");
};

export const verifyRemoteObjectAbsent = async ({ fetchImpl, artifact, sleepImpl }) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const remote = await fetchPublicObject({ fetchImpl, objectPath: artifact.objectPath, verificationKey: artifact.sha256 });
    if (remote === null) return;
    if (attempt < 3) await sleepImpl(500 * (2 ** attempt));
  }
  throw new ReleasePublishError("release-cleanup-verification-failure", "candidate artifact cleanup 검증에 실패했습니다.");
};

export const ensureImmutableObject = async ({ fetchImpl, credential, artifact, cacheControl = VERSIONED_CACHE_CONTROL }) => {
  const existing = await fetchPublicObject({ fetchImpl, objectPath: artifact.objectPath });
  if (existing !== null) {
    if (!existing.equals(artifact.contents)) {
      throw new ReleasePublishError("immutable-release-conflict", "동일 version의 remote artifact 내용이 달라 게시를 중단했습니다.");
    }
    return "existing";
  }
  await uploadObject({ fetchImpl, credential, artifact, upsert: false, cacheControl });
  return "uploaded";
};
