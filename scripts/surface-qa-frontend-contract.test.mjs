import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertQaSourceBoundary,
  scanQaBuildOutputs,
  surfaceQaBuildMetadata,
} from "./surface-qa-frontend-boundary.mjs";

test("QA source boundary accepts the isolated shell and rejects operating imports", () => {
  assert.doesNotThrow(() => assertQaSourceBoundary('import { createRoot } from "react-dom/client";'));
  assert.throws(
    () => assertQaSourceBoundary('import { App } from "../App";'),
    /operating frontend import/i,
  );
  assert.throws(
    () => assertQaSourceBoundary('import { supabase } from "../lib/supabaseClient";'),
    /forbidden QA source marker/i,
  );
});

test("built output scanner rejects production services and updater code", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bogunon-surface-qa-frontend-"));
  const mainDir = path.join(root, "main");
  const surfaceDir = path.join(root, "surface");
  await mkdir(mainDir, { recursive: true });
  await mkdir(surfaceDir, { recursive: true });
  await writeFile(path.join(mainDir, "index.html"), "SYNTHETIC ONLY", "utf8");
  await writeFile(path.join(surfaceDir, "surface.html"), "synthetic-preview", "utf8");
  await assert.doesNotReject(() => scanQaBuildOutputs([mainDir, surfaceDir]));
  await writeFile(path.join(mainDir, "index.js"), "plugin:updater", "utf8");
  await assert.rejects(() => scanQaBuildOutputs([mainDir, surfaceDir]), /forbidden built marker/i);
});

test("build metadata binds the exact source commit and QA identifier", () => {
  const sourceSha = "1".repeat(40);
  assert.deepEqual(surfaceQaBuildMetadata(sourceSha), {
    sourceSha,
    identifier: "kr.sungandi.schoolhealthdesk.surfaceqa",
    flavor: "desktop-surface-qa",
    dataPolicy: "synthetic-only",
  });
  assert.throws(() => surfaceQaBuildMetadata("not-a-commit"), /source commit/i);
});
