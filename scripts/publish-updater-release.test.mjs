import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publishUpdaterRelease } from "./publish-updater-release.mjs";
import {
  POINTER_CACHE_CONTROL,
  RELEASE_BUCKET,
  RELEASE_PROJECT_REF,
  RELEASE_PUBLIC_BASE_URL,
  VERSIONED_CACHE_CONTROL,
  validateReleaseTarget,
} from "./updater-release-publisher-contract.mjs";

const version = "0.2.0";
const credential = "fixture-storage-credential-not-a-real-secret";
const installerName = `BOGUNON-DESK-${version}-Windows-x64-Setup.exe`;
const installerUrl = `${RELEASE_PUBLIC_BASE_URL}/${version}/${installerName}`;

const createReleaseFixture = async (override = {}) => {
  const root = await mkdtemp(join(tmpdir(), "bogunon-publisher-"));
  const output = join(root, "release-output");
  await mkdir(output, { recursive: true });
  const installer = Buffer.from("synthetic-installer");
  const signature = "fixture-minisign-signature";
  const sha256 = "dbc1c3b7dec96a630df9b491b95e95d77c61bcd20288232c3b169f7b3f4860f7";
  const signatureSha256 = createHash("sha256").update(signature).digest("hex");
  const files = {
    [installerName]: installer,
    [`${installerName}.sig`]: signature,
    "SHA256SUMS.txt": `${sha256}  ${installerName}\n${signatureSha256}  ${installerName}.sig\n`,
    "README-FIRST.txt": "Synthetic release fixture\n",
    "latest.json": JSON.stringify({
      version,
      notes: "Synthetic release",
      pub_date: "2026-09-30T00:00:00.000Z",
      platforms: { "windows-x86_64": { url: installerUrl, signature } },
    }),
    "release-metadata.json": JSON.stringify({
      version,
      publishedAt: "2026-09-30T00:00:00.000Z",
      notes: ["Synthetic release"],
      installerUrl,
      sha256,
      bytes: installer.length,
    }),
    ...override,
  };
  await writeFile(join(root, "package.json"), JSON.stringify({ version }));
  await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(output, name), contents)));
  return { root, files };
};

const objectPathFromUrl = (url) => decodeURIComponent(new URL(url).pathname.split("/desktop-releases/")[1]);

const createStorageMock = (initial = new Map(), failVerificationFor = null) => {
  const objects = new Map(initial);
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const path = objectPathFromUrl(url);
    calls.push({ url: String(url), path, method: options.method ?? "GET", headers: options.headers ?? {} });
    if ((options.method ?? "GET") === "GET") {
      if (failVerificationFor === path && calls.some((call) => call.path === path && call.method === "POST")) {
        return new Response("corrupt", { status: 200 });
      }
      const value = objects.get(path);
      return value === undefined
        ? new Response(JSON.stringify({ statusCode: "404", error: "not_found" }), { status: 400 })
        : new Response(value, { status: 200 });
    }
    if (options.headers["x-upsert"] !== "true" && objects.has(path)) {
      return new Response("duplicate", { status: 409 });
    }
    objects.set(path, Buffer.from(options.body));
    return new Response("ok", { status: 200 });
  };
  return { objects, calls, fetchImpl };
};

describe("protected updater release publisher", () => {
  it("uploads new immutable artifacts, verifies them, then publishes metadata and latest last", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock();
    await publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl: storage.fetchImpl });

    const posts = storage.calls.filter((call) => call.method === "POST");
    expect(posts.map((call) => call.path)).toEqual([
      `${version}/${installerName}`,
      `${version}/${installerName}.sig`,
      `${version}/SHA256SUMS.txt`,
      `${version}/README-FIRST.txt`,
      "release-metadata.json",
      "latest.json",
    ]);
    expect(posts.slice(0, 4).every((call) => call.headers["x-upsert"] === "false")).toBe(true);
    expect(posts.slice(0, 4).every((call) => call.headers["cache-control"] === VERSIONED_CACHE_CONTROL)).toBe(true);
    expect(posts.slice(4).every((call) => call.headers["cache-control"] === POINTER_CACHE_CONTROL)).toBe(true);
  });

  it("sends the opaque privileged key only through the apikey header", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock();
    await publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl: storage.fetchImpl });

    const posts = storage.calls.filter((call) => call.method === "POST");
    expect(posts.every((call) => call.headers.apikey === credential)).toBe(true);
    expect(posts.every((call) => call.headers.authorization === undefined)).toBe(true);
    expect(storage.calls.every((call) => !call.url.includes(credential))).toBe(true);
  });

  it("accepts matching existing versioned bytes without overwriting them", async () => {
    const { root, files } = await createReleaseFixture();
    const existing = new Map(Object.entries(files).slice(0, 4).map(([name, contents]) => [`${version}/${name}`, Buffer.from(contents)]));
    const storage = createStorageMock(existing);
    const result = await publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl: storage.fetchImpl });
    expect(result.versionedResults).toEqual(["existing", "existing", "existing", "existing"]);
    expect(storage.calls.filter((call) => call.method === "POST").map((call) => call.path)).toEqual([
      "release-metadata.json",
      "latest.json",
    ]);
  });

  it("hard-fails on a conflicting immutable object and never publishes pointers", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock(new Map([[`${version}/${installerName}`, Buffer.from("different")]]));
    await expect(publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl: storage.fetchImpl, sleepImpl: async () => {} }))
      .rejects.toThrow("동일 version");
    expect(storage.calls.some((call) => call.path === "latest.json")).toBe(false);
  });

  it("does not publish pointers when immutable remote verification fails", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock(new Map(), `${version}/${installerName}`);
    await expect(publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl: storage.fetchImpl, sleepImpl: async () => {} }))
      .rejects.toThrow("검증에 실패");
    expect(storage.calls.some((call) => call.path === "release-metadata.json")).toBe(false);
    expect(storage.calls.some((call) => call.path === "latest.json")).toBe(false);
  });

  it("does not publish latest when release metadata verification fails", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock(new Map(), "release-metadata.json");
    await expect(publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl: storage.fetchImpl, sleepImpl: async () => {} }))
      .rejects.toThrow("검증에 실패");
    expect(storage.calls.some((call) => call.path === "latest.json" && call.method === "POST")).toBe(false);
  });

  it("fails before network when the credential is missing", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock();
    await expect(publishUpdaterRelease({ projectRoot: root, version, credential: "", fetchImpl: storage.fetchImpl }))
      .rejects.toThrow("credential");
    expect(storage.calls).toHaveLength(0);
  });

  it("fails before network when a release file is missing", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock();
    await rm(join(root, "release-output", "README-FIRST.txt"));
    await expect(publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl: storage.fetchImpl }))
      .rejects.toThrow("6-file contract");
    expect(storage.calls).toHaveLength(0);
  });

  it("rejects installer and manifest version mismatches before network", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock();
    await expect(publishUpdaterRelease({ projectRoot: root, version: "0.2.1", credential, fetchImpl: storage.fetchImpl }))
      .rejects.toThrow("package.json version");
    expect(storage.calls).toHaveLength(0);
  });

  it("sanitizes fetch failures without exposing credential material", async () => {
    const { root } = await createReleaseFixture();
    const fetchImpl = async () => { throw new Error(`network ${credential}`); };
    let exposed = "";
    try {
      await publishUpdaterRelease({ projectRoot: root, version, credential, fetchImpl });
    } catch (error) {
      exposed = error instanceof Error ? error.message : String(error);
    }
    expect(exposed).not.toContain(credential);
    expect(exposed).toContain("연결하지 못했습니다");
  });

  it("rejects any project, bucket, or public base other than the fixed production target", () => {
    expect(() => validateReleaseTarget({
      projectRef: "wrong-project",
      bucket: RELEASE_BUCKET,
      publicBaseUrl: RELEASE_PUBLIC_BASE_URL,
    })).toThrow("승인된");
    expect(() => validateReleaseTarget({
      projectRef: RELEASE_PROJECT_REF,
      bucket: "wrong-bucket",
      publicBaseUrl: RELEASE_PUBLIC_BASE_URL,
    })).toThrow("승인된");
  });
});
