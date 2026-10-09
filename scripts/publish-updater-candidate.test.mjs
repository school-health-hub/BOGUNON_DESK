import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupCandidateRelease, publishCandidateRelease } from "./publish-updater-release.mjs";
import { RELEASE_PUBLIC_BASE_URL } from "./updater-release-publisher-contract.mjs";

const version = "0.2.0";
const credential = "fixture-storage-credential-not-a-real-secret";
const installerName = `BOGUNON-DESK-${version}-Windows-x64-Setup.exe`;
const installerUrl = `${RELEASE_PUBLIC_BASE_URL}/${version}/${installerName}`;

const createReleaseFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "bogunon-candidate-publisher-"));
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
  };
  await writeFile(join(root, "package.json"), JSON.stringify({ version }));
  await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(output, name), contents)));
  return { root };
};

const objectPathFromUrl = (url) => decodeURIComponent(new URL(url).pathname.split("/desktop-releases/")[1]);

const createStorageMock = ({ retainDeleted = false } = {}) => {
  const objects = new Map();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const path = objectPathFromUrl(url);
    calls.push({ path, method: options.method ?? "GET", headers: options.headers ?? {} });
    if ((options.method ?? "GET") === "GET") {
      const value = objects.get(path);
      return value === undefined
        ? new Response(JSON.stringify({ statusCode: "404", error: "not_found" }), { status: 400 })
        : new Response(value, { status: 200 });
    }
    if ((options.method ?? "GET") === "DELETE") {
      if (!retainDeleted) objects.delete(path);
      return new Response("ok", { status: 200 });
    }
    objects.set(path, Buffer.from(options.body));
    return new Response("ok", { status: 200 });
  };
  return { objects, calls, fetchImpl };
};

describe("candidate updater release publisher", () => {
  it("publishes a candidate namespace without touching production latest", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock();
    const result = await publishCandidateRelease({ projectRoot: root, version, runId: "12345-1", credential, fetchImpl: storage.fetchImpl });

    expect(result.latestUrl).toBe(`${RELEASE_PUBLIC_BASE_URL}/candidate/${version}/12345-1/latest.json`);
    expect(storage.calls.filter((call) => call.method === "POST").map((call) => call.path)).toEqual([
      `candidate/${version}/12345-1/${installerName}`,
      `candidate/${version}/12345-1/${installerName}.sig`,
      `candidate/${version}/12345-1/SHA256SUMS.txt`,
      `candidate/${version}/12345-1/README-FIRST.txt`,
      `candidate/${version}/12345-1/release-metadata.json`,
      `candidate/${version}/12345-1/latest.json`,
    ]);
    expect(storage.calls.every((call) => call.path !== "latest.json")).toBe(true);
  });

  it("cleans up the candidate namespace without touching production latest", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock();
    await publishCandidateRelease({ projectRoot: root, version, runId: "12345", credential, fetchImpl: storage.fetchImpl });
    await cleanupCandidateRelease({ projectRoot: root, version, runId: "12345", credential, fetchImpl: storage.fetchImpl });

    expect([...storage.objects.keys()].filter((key) => key.startsWith(`candidate/${version}/12345/`))).toEqual([]);
    expect(storage.calls.some((call) => call.path === "latest.json")).toBe(false);
  });

  it("fails cleanup when remote candidate objects remain after deletion", async () => {
    const { root } = await createReleaseFixture();
    const storage = createStorageMock({ retainDeleted: true });
    await publishCandidateRelease({ projectRoot: root, version, runId: "12345", credential, fetchImpl: storage.fetchImpl });

    await expect(cleanupCandidateRelease({
      projectRoot: root,
      version,
      runId: "12345",
      credential,
      fetchImpl: storage.fetchImpl,
      sleepImpl: async () => {},
    })).rejects.toThrow("cleanup 검증");
  });
});
