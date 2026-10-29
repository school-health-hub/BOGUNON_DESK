import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const QA_IDENTIFIER = "kr.sungandi.schoolhealthdesk.surfaceqa";
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SOURCE_MARKERS = [
  "@supabase/supabase-js",
  "supabaseClient",
  "@tauri-apps/plugin-updater",
  "@tauri-apps/plugin-deep-link",
  "downloadAndInstall",
  "fetch(",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
];
const BUILD_MARKERS = [
  "supabase.co",
  "bogunon.vercel.app",
  "plugin:updater",
  "downloadAndInstall",
  "oauth",
  "access_token",
];
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map", ".mjs"]);
const ALLOWED_INVOKE_COMMANDS = new Set([
  "begin_desktop_surface_edit",
  "complete_desktop_surface_edit",
  "cancel_desktop_surface_edit",
]);

function assertQaInvokeBoundary(source) {
  const invokeCalls = [...source.matchAll(/\binvoke\s*\(/gu)];
  const literalCalls = [...source.matchAll(/\binvoke\s*\(\s*["']([^"']+)["']/gu)];
  if (invokeCalls.length !== literalCalls.length) {
    throw new Error("Dynamic QA invoke command is forbidden");
  }
  for (const match of literalCalls) {
    if (!ALLOWED_INVOKE_COMMANDS.has(match[1])) {
      throw new Error(`Forbidden QA invoke command: ${match[1]}`);
    }
  }
}

export function assertQaSourceBoundary(source) {
  for (const marker of SOURCE_MARKERS) {
    if (source.includes(marker)) throw new Error(`Forbidden QA source marker: ${marker}`);
  }
  if (/\bfrom\s+["']\.\.\//u.test(source) || /\bimport\s*\(\s*["']\.\.\//u.test(source)) {
    throw new Error("Operating frontend import is forbidden in the QA shell");
  }
  assertQaInvokeBoundary(source);
}

async function textFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await textFiles(candidate));
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) files.push(candidate);
  }
  return files;
}

export async function scanQaBuildOutputs(roots) {
  for (const root of roots) {
    for (const file of await textFiles(root)) {
      const source = (await readFile(file, "utf8")).toLowerCase();
      for (const marker of BUILD_MARKERS) {
        if (source.includes(marker.toLowerCase())) {
          throw new Error(`Forbidden built marker in ${path.basename(file)}: ${marker}`);
        }
      }
    }
  }
}

export function surfaceQaBuildMetadata(sourceSha) {
  if (!SHA_PATTERN.test(sourceSha)) throw new Error("QA source commit must be an exact 40-character SHA");
  return {
    sourceSha,
    identifier: QA_IDENTIFIER,
    flavor: "desktop-surface-qa",
    dataPolicy: "synthetic-only",
  };
}
