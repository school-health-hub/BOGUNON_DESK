import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "vite";

import {
  assertQaSourceBoundary,
  scanQaBuildOutputs,
  surfaceQaBuildMetadata,
} from "./surface-qa-frontend-boundary.mjs";

const QA_SOURCE_ROOT = "src/surface-qa";
const MAIN_OUTPUT = "dist-surface-qa-main";
const SURFACE_OUTPUT = "dist-surface-preview";

async function scanQaSources(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) await scanQaSources(candidate);
    else if (/\.(?:css|ts|tsx)$/u.test(entry.name)) assertQaSourceBoundary(await readFile(candidate, "utf8"));
  }
}

const checkedOutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceSha = process.env.BOGUNON_SURFACE_QA_SOURCE_SHA ?? checkedOutSha;
if (sourceSha !== checkedOutSha) throw new Error("Configured QA source SHA does not match the checked-out commit");
const metadata = surfaceQaBuildMetadata(sourceSha);
await scanQaSources(QA_SOURCE_ROOT);
process.env.VITE_SURFACE_QA_SOURCE_SHA = sourceSha;
await build({ configFile: "vite.surface-qa.config.ts" });
await build({ configFile: "vite.surface.config.ts" });
const serializedMetadata = `${JSON.stringify(metadata, null, 2)}\n`;
await writeFile(path.join(MAIN_OUTPUT, "qa-build.json"), serializedMetadata, "utf8");
await writeFile(path.join(SURFACE_OUTPUT, "qa-build.json"), serializedMetadata, "utf8");
await scanQaBuildOutputs([MAIN_OUTPUT, SURFACE_OUTPUT]);
