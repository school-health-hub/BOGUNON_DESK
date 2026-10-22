import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SOURCE,
  inventory,
  isAllowedControllerPath,
  validateDispatch,
  verifyResolverLocks,
} from './desktop-surface-c2c2.mjs';

const controllerSha = 'a'.repeat(40);
const valid = {
  repository: 'school-health-hub/BOGUNON_DESK',
  event: 'workflow_dispatch',
  ref: 'refs/heads/feature/dashboard-mint-ivory-v2',
  attempt: '1',
  sha: controllerSha,
  expected: controllerSha,
  workflowSha: controllerSha,
  workflowRef: 'school-health-hub/BOGUNON_DESK/.github/workflows/desktop-surface-c2c2-native.yml@refs/heads/feature/dashboard-mint-ivory-v2',
};

test('reviewed C-2C-2 controller dispatch is admitted', () => {
  assert.doesNotThrow(() => validateDispatch(valid));
});

for (const [key, value] of Object.entries({
  repository: 'fork/BOGUNON_DESK',
  event: 'push',
  ref: 'refs/heads/main',
  attempt: '2',
  sha: 'b'.repeat(40),
  expected: 'invalid',
  workflowSha: 'b'.repeat(40),
  workflowRef: 'another-workflow',
})) {
  test(`dispatch rejects mismatched ${key}`, () => {
    assert.throws(() => validateDispatch({ ...valid, [key]: value }));
  });
}

test('immutable C-2C-1 source SHA is fixed', () => {
  assert.equal(SOURCE, 'e2b73675c8662990024e69bfa12e060cc68a9440');
});

test('only dedicated C-2C-2 controller files are admitted', () => {
  for (const path of [
    '.github/workflows/desktop-surface-c2c2-native.yml',
    'scripts/desktop-surface-c2c2.mjs',
    'scripts/desktop-surface-c2c2.contract.mjs',
    'qa/c2c2-acl/Cargo.toml',
    'docs/DESKTOP_SURFACE_C2C2_CI.md',
  ]) {
    assert.equal(isAllowedControllerPath(path), true, path);
  }
  for (const path of [
    '.github/workflows/desktop-surface-c1-native.yml',
    'src-tauri/src/lib.rs',
    'qa/c2b-contract.rs',
    'Cargo.lock',
  ]) {
    assert.equal(isAllowedControllerPath(path), false, path);
  }
});

test('source inventories remain 61 production, 12 QA and 62 unique', () => {
  const result = inventory(new URL('../', import.meta.url));
  assert.equal(result.production.length, 61);
  assert.equal(result.qa.length, 12);
  assert.equal(result.all.length, 62);
});

test('resolver lock mismatch is rejected', () => {
  const lock = readFileSync(new URL('../src-tauri/Cargo.lock', import.meta.url), 'utf8');
  assert.doesNotThrow(() => verifyResolverLocks(lock, lock));
  assert.throws(() => verifyResolverLocks(lock, lock.replace('version = "2.11.5"', 'version = "2.11.6"')));
});

test('command line denies automatic events before touching a checkout', () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('./desktop-surface-c2c2.mjs', import.meta.url)),
    'guard',
    'C:/nonexistent-controller',
    'C:/nonexistent-source',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_REPOSITORY: valid.repository,
      GITHUB_EVENT_NAME: 'push',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /workflow_dispatch/);
  assert.doesNotMatch(result.stderr, /not a git repository/);
});

test('workflow compiles immutable source in two configurations without deployment paths', () => {
  const yaml = readFileSync(new URL('../.github/workflows/desktop-surface-c2c2-native.yml', import.meta.url), 'utf8');
  assert.match(yaml, /configuration: \[production, finance-qa\]/);
  assert.match(yaml, /ref: e2b73675c8662990024e69bfa12e060cc68a9440/);
  assert.match(yaml, /github\.sha == inputs\.expected_controller_sha/);
  assert.match(yaml, /github\.run_attempt == 1/);
  assert.match(yaml, /contents: read/);
  assert.equal((yaml.match(/persist-credentials: false/g) ?? []).length, 2);
  assert.match(yaml, /rustc --edition 2021 -D warnings --test qa\/c2b-contract\.rs/);
  assert.match(yaml, /rustc --edition 2021 -D warnings --test qa\/c2c-contract\.rs/);
  assert.match(yaml, /cargo check --locked[^\n]*--all-targets/);
  assert.match(yaml, /cargo test --locked[^\n]*--lib/);
  assert.doesNotMatch(yaml, /\bsecrets\.|environment:|workflow_call:|pull_request:|\bpush:|continue-on-error:|--bundles|release:windows|tauri build/);
  const upload = yaml.slice(yaml.indexOf('path: |'));
  assert.doesNotMatch(upload, /\.exe|\.zip|target\/|release-output|\*\*/);
  assert.match(upload, /C2C2-ACL-REPORT\.json/);
  assert.match(upload, /contracts\.json/);
});
