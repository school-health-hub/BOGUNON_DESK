import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const parseDotEnv = (source) => {
  const result = {};
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
};

export const parseCargoVersion = (source) => {
  const packageStart = source.search(/^\[package\]\s*$/mu);
  if (packageStart < 0) throw new Error("Cargo.toml package version을 확인할 수 없습니다.");
  const afterHeader = source.indexOf("\n", packageStart);
  const sectionStart = afterHeader < 0 ? source.length : afterHeader + 1;
  const nextSectionOffset = source.slice(sectionStart).search(/^\[/mu);
  const packageSection = nextSectionOffset < 0
    ? source.slice(sectionStart)
    : source.slice(sectionStart, sectionStart + nextSectionOffset);
  const version = /^version\s*=\s*"([^"]+)"\s*$/mu.exec(packageSection)?.[1];
  if (version === undefined) throw new Error("Cargo.toml package version을 확인할 수 없습니다.");
  return version;
};

const decodeLegacyRole = (key) => {
  const payload = key.split(".")[1];
  if (payload === undefined) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed === "object" && parsed !== null && typeof parsed.role === "string"
      ? parsed.role
      : null;
  } catch {
    return null;
  }
};

const isPublicClientKey = (key) =>
  key.startsWith("sb_publishable_") || decodeLegacyRole(key) === "anon";

const supabaseOriginsInCsp = (value) => {
  if (typeof value !== "string") return [];
  return value.split(/\s+/u).flatMap((source) => {
    try {
      const url = new URL(source);
      return url.protocol === "https:" && url.hostname.endsWith(".supabase.co")
        ? [url.origin]
        : [];
    } catch {
      return [];
    }
  });
};

const hasOnlyExpectedSupabaseOrigin = (value, expectedOrigin) => {
  const origins = supabaseOriginsInCsp(value);
  return origins.length === 1 && origins[0] === expectedOrigin;
};

export const validateReleaseConfiguration = ({
  packageVersion,
  tauriVersion,
  cargoVersion,
  supabaseUrl,
  supabaseKey,
  expectedSupabaseOrigin,
  cspConnectSrc,
  devCspConnectSrc,
}) => {
  if (packageVersion !== tauriVersion || packageVersion !== cargoVersion) {
    throw new Error("package.json, tauri.conf.json, Cargo.toml 버전이 일치하지 않습니다.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl.trim());
  } catch {
    throw new Error("공유 빌드에 필요한 Supabase 공개 설정이 없습니다.");
  }

  const key = supabaseKey.trim();
  if (
    parsedUrl.protocol !== "https:"
    || key === ""
  ) {
    throw new Error("공유 빌드에 필요한 Supabase 공개 설정이 없습니다.");
  }
  if (parsedUrl.origin !== expectedSupabaseOrigin) {
    throw new Error("release build의 Supabase project origin이 production 설정과 일치하지 않습니다.");
  }
  if (!isPublicClientKey(key)) {
    throw new Error("release build에 secret/service_role key를 사용할 수 없습니다.");
  }
  if (
    !hasOnlyExpectedSupabaseOrigin(cspConnectSrc, expectedSupabaseOrigin)
    || !hasOnlyExpectedSupabaseOrigin(devCspConnectSrc, expectedSupabaseOrigin)
  ) {
    throw new Error("Tauri CSP의 Supabase project origin이 production 설정과 일치하지 않습니다.");
  }
};

const readOptionalFile = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return "";
    throw error;
  }
};

export const runReleasePreflight = async (root = projectRoot) => {
  const [packageSource, tauriSource, cargoSource, envSource, productionSupabaseSource] = await Promise.all([
    readFile(resolve(root, "package.json"), "utf8"),
    readFile(resolve(root, "src-tauri", "tauri.conf.json"), "utf8"),
    readFile(resolve(root, "src-tauri", "Cargo.toml"), "utf8"),
    readOptionalFile(resolve(root, ".env.local")),
    readFile(resolve(root, "config", "production-supabase.json"), "utf8"),
  ]);
  const packageManifest = JSON.parse(packageSource);
  const tauriConfig = JSON.parse(tauriSource);
  const localEnv = parseDotEnv(envSource);
  const productionSupabase = JSON.parse(productionSupabaseSource);
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? localEnv.VITE_SUPABASE_URL ?? "";
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? localEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const packageVersion = typeof packageManifest.version === "string" ? packageManifest.version : "";
  const tauriVersion = typeof tauriConfig.version === "string" ? tauriConfig.version : "";
  const cargoVersion = parseCargoVersion(cargoSource);
  const expectedSupabaseOrigin = typeof productionSupabase.origin === "string"
    ? productionSupabase.origin
    : "";
  const cspConnectSrc = tauriConfig.app?.security?.csp?.["connect-src"];
  const devCspConnectSrc = tauriConfig.app?.security?.devCsp?.["connect-src"];

  validateReleaseConfiguration({
    packageVersion,
    tauriVersion,
    cargoVersion,
    supabaseUrl,
    supabaseKey,
    expectedSupabaseOrigin,
    cspConnectSrc,
    devCspConnectSrc,
  });
  process.stdout.write(`[release:check] BOGUNON DESK ${packageVersion} 공개 설정과 버전을 확인했습니다.\n`);
};

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  runReleasePreflight().catch((error) => {
    const message = error instanceof Error ? error.message : "release preflight에 실패했습니다.";
    process.stderr.write(`[release:check] ${message}\n`);
    process.exitCode = 1;
  });
}
