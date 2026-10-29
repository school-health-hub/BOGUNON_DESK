import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Given CI workflow, When reviewed offline, Then only manual isolated build and explicit artifact files are configured', () => {
  const workflow = read('.github/workflows/finder-home-qa-windows.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule|workflow_run):/m);
  assert.match(workflow, /runs-on: windows-2022/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node-version: '22\.23\.3'/);
  assert.match(workflow, /toolchain: '1\.98\.1'/);
  assert.match(workflow, /retention-days: 7/);
  assert.doesNotMatch(workflow, /secrets\.|environment:|Start-Process|release:|npm run build/);
  const artifact = workflow.split('name: Upload only executable and provenance')[1];
  assert.ok(artifact);
  assert.equal((artifact.match(/\/artifact\//g) ?? []).length, 3);
  assert.doesNotMatch(artifact, /\*|target|webview|\.env/);
});

test('Given build script, When source or checkout differs, Then fail-closed guards precede compilation and no executable is launched', () => {
  const source = read('scripts/build-finder-home-qa-ci.mjs');
  assert.match(source, /git\(\['rev-parse', 'HEAD'\]\) !== expected/);
  assert.match(source, /--locked.*--offline/);
  assert.match(source, /finder-home-qa,tauri\/custom-protocol/);
  assert.match(source, /sha256/);
  assert.doesNotMatch(source, /^run\(executable|Start-Process|--bundles|release:|--release/m);
});

test('Given portable Native entry, When built on a different PC, Then runtime has no compiled runner path dependency', () => {
  const source = read('src-tauri/src/finder_home_qa.rs');
  assert.match(source, /std::env::var\("BOGUNON_FINDER_HOME_QA_RUNTIME_ROOT"\)/);
  assert.doesNotMatch(source, /env!\("CARGO_MANIFEST_DIR"\)|env!\("BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT"\)/);
  const paths = read('src-tauri/src/finder_home_qa_paths.rs');
  assert.match(paths, /create_new\(true\)/);
  assert.match(paths, /owner\["sourceSha"\] != self.source_sha/);
  assert.doesNotMatch(paths, /projectRoot|project_root|app_local_data_dir|std::env::var\("APPDATA"\)/);
});
