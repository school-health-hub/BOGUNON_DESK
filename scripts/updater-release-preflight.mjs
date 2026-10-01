import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedEndpoint = "https://xxownwxxajzrviuvvfiu.supabase.co/storage/v1/object/public/desktop-releases/latest.json";

export const validateUpdaterReleaseConfiguration = ({
  updater,
  releaseBundle,
  notes,
  signingKeyConfigured,
  signingPasswordConfigured,
  publishedAt,
}) => {
  if (typeof updater?.pubkey !== "string" || updater.pubkey.trim() === "") {
    throw new Error("updater public key가 설정되지 않았습니다.");
  }
  if (!Array.isArray(updater.endpoints) || updater.endpoints.length !== 1 || updater.endpoints[0] !== expectedEndpoint) {
    throw new Error("updater endpoint가 production release channel과 일치하지 않습니다.");
  }
  if (updater.windows?.installMode !== "passive") throw new Error("Windows updater installMode는 passive여야 합니다.");
  if (releaseBundle?.createUpdaterArtifacts !== true) throw new Error("release overlay에서 updater artifact 생성이 활성화되지 않았습니다.");
  if (!Array.isArray(notes) || notes.length === 0) throw new Error("release notes가 비어 있습니다.");
  if (!signingKeyConfigured) throw new Error("updater signing private key source가 설정되지 않았습니다.");
  if (!signingPasswordConfigured) throw new Error("updater signing private key password가 설정되지 않았습니다.");
  if (typeof publishedAt !== "string" || Number.isNaN(Date.parse(publishedAt)) || new Date(publishedAt).toISOString() !== publishedAt) {
    throw new Error("RELEASE_PUBLISHED_AT은 UTC RFC3339 형식이어야 합니다.");
  }
};

export const runUpdaterReleasePreflight = async (root = projectRoot, environment = process.env) => {
  const [baseSource, releaseSource, notesSource] = await Promise.all([
    readFile(resolve(root, "src-tauri", "tauri.conf.json"), "utf8"),
    readFile(resolve(root, "src-tauri", "tauri.release.conf.json"), "utf8"),
    readFile(resolve(root, "release", "release-notes.json"), "utf8"),
  ]);
  const baseConfig = JSON.parse(baseSource);
  const releaseConfig = JSON.parse(releaseSource);
  const releaseNotes = JSON.parse(notesSource);
  const signingKeyConfigured = Boolean(
    environment.TAURI_SIGNING_PRIVATE_KEY?.trim()
    || environment.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim(),
  );
  const signingPasswordConfigured = Boolean(environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD?.trim());
  validateUpdaterReleaseConfiguration({
    updater: baseConfig.plugins?.updater,
    releaseBundle: releaseConfig.bundle,
    notes: releaseNotes.notes,
    signingKeyConfigured,
    signingPasswordConfigured,
    publishedAt: environment.RELEASE_PUBLISHED_AT,
  });
  process.stdout.write("[release:updater:check] private key source configured = YES\n");
  process.stdout.write("[release:updater:check] password configured = YES\n");
};

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  runUpdaterReleasePreflight().catch((error) => {
    const message = error instanceof Error ? error.message : "updater release preflight에 실패했습니다.";
    process.stderr.write(`[release:updater:check] ${message}\n`);
    process.exitCode = 1;
  });
}
