import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCargoVersion } from "./release-preflight.mjs";

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

export const verifyReleaseVersion = async ({ projectRoot = defaultProjectRoot, expectedVersion }) => {
  if (typeof expectedVersion !== "string" || !semverPattern.test(expectedVersion)) {
    throw new Error("workflow release version이 유효한 SemVer가 아닙니다.");
  }
  const [packageSource, tauriSource, cargoSource] = await Promise.all([
    readFile(resolve(projectRoot, "package.json"), "utf8"),
    readFile(resolve(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"),
    readFile(resolve(projectRoot, "src-tauri", "Cargo.toml"), "utf8"),
  ]);
  const packageVersion = JSON.parse(packageSource).version;
  const tauriVersion = JSON.parse(tauriSource).version;
  const cargoVersion = parseCargoVersion(cargoSource);
  if (expectedVersion !== packageVersion || expectedVersion !== tauriVersion || expectedVersion !== cargoVersion) {
    throw new Error("workflow input version과 package/Tauri/Cargo version이 일치하지 않습니다.");
  }
  return expectedVersion;
};

const run = async () => {
  const version = await verifyReleaseVersion({ expectedVersion: process.env.RELEASE_VERSION });
  process.stdout.write(`[release:version] BOGUNON DESK ${version} version guard passed.\n`);
};

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : "release version 검증에 실패했습니다.";
    process.stderr.write(`[release:version] ${message}\n`);
    process.exitCode = 1;
  });
}
