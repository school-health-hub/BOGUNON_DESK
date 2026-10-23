import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { officialDocumentQaPaths } from "./official-document-qa-paths.mjs";

test("preserves legacy paths when the optional root is absent", () => {
  const paths = officialDocumentQaPaths(process.cwd(), {});
  assert.equal(paths.dist, resolve("dist-official-document-qa"));
  assert.equal(paths.target, resolve("src-tauri/target-official-document-qa"));
});

test("uses one absolute external root for all build outputs", () => {
  const root = resolve(process.env.TEMP, "official-document-test-output");
  const paths = officialDocumentQaPaths(process.cwd(), { BOGUNON_OFFICIAL_DOCUMENT_QA_OUTPUT_ROOT: root });
  assert.equal(paths.dist, resolve(root, "dist-official-document-qa"));
  assert.equal(paths.target, resolve(root, "target"));
  assert.equal(paths.temp, resolve(root, "temp"));
});

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, parse } from "node:path";
import { spawnSync } from "node:child_process";
import { officialDocumentQaConfig, officialDocumentQaEnvironment, prepareOfficialDocumentQaPaths, QA_OUTPUT_ROOT_ENV, requireFreshOfficialDocumentQaDist } from "./official-document-qa-paths.mjs";

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), "official-qa-path-test-"));
  t.after(() => {
    assert.equal(dirname(root), resolve(tmpdir()));
    rmSync(root, { recursive: true });
  });
  return root;
}
const at = (root) => officialDocumentQaPaths(process.cwd(), { [QA_OUTPUT_ROOT_ENV]: root });

for (const raw of ["", "relative/path", parse(process.cwd()).root, process.cwd(), dirname(process.cwd())]) {
  test(`rejects unsafe output root ${JSON.stringify(raw)}`, () => {
    assert.throws(() => at(raw), /absolute|outside/);
  });
}

test("claims an empty external root and permits same-worktree reuse", (t) => {
  const root = sandbox(t);
  const paths = at(root);
  prepareOfficialDocumentQaPaths(paths);
  prepareOfficialDocumentQaPaths(paths);
  assert.equal(JSON.parse(readFileSync(join(root, ".official-document-qa-output.json"), "utf8")).identifier, "kr.sungandi.schoolhealthdesk.officialdocumentqa");
  assert.ok(existsSync(paths.temp));
  assert.ok(existsSync(paths.logs));
  assert.ok(!readdirSync(root).some((name) => name.startsWith(".write-probe")));
});

test("rejects occupied unowned root without overwriting files", (t) => {
  const root = sandbox(t);
  const file = join(root, "existing-evidence.txt");
  writeFileSync(file, "preserve");
  assert.throws(() => prepareOfficialDocumentQaPaths(at(root)), /not owned/);
  assert.equal(readFileSync(file, "utf8"), "preserve");
  assert.deepEqual(readdirSync(root), ["existing-evidence.txt"]);
});

test("rejects output root that is a file", (t) => {
  const root = sandbox(t);
  const file = join(root, "file");
  writeFileSync(file, "preserve");
  assert.throws(() => prepareOfficialDocumentQaPaths(at(file)), /not a directory/);
  assert.equal(readFileSync(file, "utf8"), "preserve");
});

test("rejects a disconnected Windows drive before creating outputs", { skip: process.platform !== "win32" }, () => {
  const drive = [..."ZYXWVUTSRQPONMLKJIHGFED"].find((letter) => !existsSync(`${letter}:/`));
  assert.ok(drive, "test requires one unused drive letter");
  assert.throws(() => prepareOfficialDocumentQaPaths(at(`${drive}:/official-qa-test`)), /drive connection/);
});

test("refuses to clear an existing external frontend directory", (t) => {
  const paths = at(sandbox(t));
  prepareOfficialDocumentQaPaths(paths);
  mkdirSync(paths.dist);
  const file = join(paths.dist, "previous.js");
  writeFileSync(file, "old output");
  assert.throws(() => requireFreshOfficialDocumentQaDist(paths), /will not be emptied/);
  assert.equal(readFileSync(file, "utf8"), "old output");
});

test("passes process-local target/temp/cache paths without mutating caller environment", (t) => {
  const env = Object.freeze({ PATH: "preserved" });
  const paths = at(sandbox(t));
  const next = officialDocumentQaEnvironment(paths, env);
  assert.equal(next.CARGO_TARGET_DIR, paths.target);
  assert.equal(next.TEMP, paths.temp);
  assert.equal(next.TMP, paths.temp);
  assert.equal(next.PSModuleAnalysisCachePath, paths.moduleCache);
  assert.deepEqual(env, { PATH: "preserved" });
});

test("changes only QA frontend resources, preserving identity and runtime isolation", (t) => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.official-document-qa.conf.json", "utf8"));
  const paths = at(sandbox(t));
  const overlay = officialDocumentQaConfig(config, paths);
  assert.equal(overlay.build.frontendDist, paths.dist);
  assert.equal(overlay.build.beforeBuildCommand, null);
  assert.deepEqual(overlay.app, config.app);
  assert.deepEqual(overlay.plugins, config.plugins);
  assert.equal(overlay.identifier, config.identifier);
  assert.equal(config.build.frontendDist, "../dist-official-document-qa");
  assert.equal(officialDocumentQaConfig(config, officialDocumentQaPaths(process.cwd(), {})), config);
});

for (const script of ["build-official-document-qa.mjs", "build-official-document-qa-frontend.mjs"]) {
  test(`${script} prints external paths without building or writing`, (t) => {
    const root = sandbox(t);
    const output = join(root, "not-created");
    const result = spawnSync(process.execPath, [join("scripts", script), "--print-paths"], { encoding: "utf8", env: { ...process.env, [QA_OUTPUT_ROOT_ENV]: output } });
    assert.equal(result.status, 0, result.stderr);
    const paths = JSON.parse(result.stdout);
    assert.equal(paths.dist, join(output, "dist-official-document-qa"));
    assert.equal(paths.target, join(output, "target"));
    if (paths.tauriConfig) assert.equal(paths.tauriConfig.build.frontendDist, paths.dist);
    assert.equal(existsSync(output), false);
  });
  test(`${script} reports invalid root without building`, () => {
    const result = spawnSync(process.execPath, [join("scripts", script), "--print-paths"], { encoding: "utf8", env: { ...process.env, [QA_OUTPUT_ROOT_ENV]: "relative" } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /absolute local drive path/);
  });
}

test("binds Rust QA-only stamp/config paths to the same output-root contract", () => {
  const rust = readFileSync("src-tauri/build.rs", "utf8");
  const qa = rust.slice(rust.indexOf("} else if official_document_qa {"), rust.indexOf("    } else {", rust.indexOf("} else if official_document_qa {")));
  assert.ok(qa.includes('var_os("BOGUNON_OFFICIAL_DOCUMENT_QA_OUTPUT_ROOT")'));
  assert.ok(qa.includes('root.join("dist-official-document-qa")'));
  assert.ok(qa.includes('frontend_dist.join("qa-build.json")'));
  assert.ok(qa.includes('read_to_string(&stamp_path)'));
  assert.ok(qa.includes('stamp["frontendDist"]'));
});

test("rejects nested junctions in an owned target before writes can escape", (t) => {
  const root = sandbox(t);
  const paths = at(join(root, "owned"));
  prepareOfficialDocumentQaPaths(paths);
  const outside = join(root, "other-work");
  mkdirSync(outside);
  mkdirSync(paths.target);
  symlinkSync(outside, join(paths.target, "x86_64-pc-windows-msvc"), "junction");
  assert.throws(() => prepareOfficialDocumentQaPaths(paths), /symlink|junction/);
  assert.deepEqual(readdirSync(outside), []);
});

test("rejects a dangling junction output root before creating its target", (t) => {
  const root = sandbox(t);
  const missing = join(root, "missing");
  const link = join(root, "link");
  symlinkSync(missing, link, "junction");
  assert.throws(() => prepareOfficialDocumentQaPaths(at(link)), /symlink|junction/);
  assert.equal(existsSync(missing), false);
});
