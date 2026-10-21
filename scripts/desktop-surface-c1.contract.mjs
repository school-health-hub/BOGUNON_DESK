import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateDispatch, inventory, verifyResolverLocks } from './desktop-surface-c1.mjs';

const valid = {
  repository: 'school-health-hub/BOGUNON_DESK', event: 'workflow_dispatch',
  ref: 'refs/heads/feature/dashboard-mint-ivory-v2', attempt: '1',
  sha: 'a'.repeat(40), expected: 'a'.repeat(40), workflowSha: 'a'.repeat(40),
  workflowRef: 'school-health-hub/BOGUNON_DESK/.github/workflows/desktop-surface-c1-native.yml@refs/heads/feature/dashboard-mint-ivory-v2',
};
test('reviewed controller dispatch is admitted', () => assert.doesNotThrow(() => validateDispatch(valid)));
for (const [key, value] of Object.entries({
  repository: 'fork/BOGUNON_DESK', event: 'push', ref: 'refs/heads/main',
  attempt: '2', sha: 'b'.repeat(40), expected: 'invalid', workflowSha: 'b'.repeat(40),
  workflowRef: 'another-workflow',
})) {
  test(`dispatch rejects mismatched ${key}`, () => {
    assert.throws(() => validateDispatch({ ...valid, [key]: value }));
  });
}
test('C0 inventories are 61 production, 12 QA and 62 unique', () => {
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
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./desktop-surface-c1.mjs', import.meta.url)), 'guard',
    'C:/nonexistent-controller', 'C:/nonexistent-source'], {
    encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: valid.repository, GITHUB_EVENT_NAME: 'push' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /workflow_dispatch/);
  assert.doesNotMatch(result.stderr, /not a git repository/);
});

test('LF and CRLF handler inventories are identical', () => {
  const base = new URL('../', import.meta.url);
  const current = inventory(base);
  assert.deepEqual(inventory(fileURLToPath(base)), current);
  for (const file of ['src-tauri/src/lib.rs', 'src-tauri/src/my_finance_qa.rs']) {
    const text = readFileSync(new URL(file, base), 'utf8');
    const entries = (value) => value.match(/generate_handler!\[([\s\S]*?)\]/)[1]
      .split(',').map((entry) => entry.trim()).filter(Boolean);
    assert.deepEqual(entries(text.replace(/\r?\n/g, '\r\n')), entries(text.replace(/\r\n/g, '\n')));
  }
});

test('workflow retains configuration matrix, immutable source and no deployment paths', () => {
  const yaml = readFileSync(new URL('../.github/workflows/desktop-surface-c1-native.yml', import.meta.url), 'utf8');
  assert.match(yaml, /configuration: \[production, finance-qa\]/);
  assert.match(yaml, /ref: ab5eb3f078b63428511d758137ba7747e54396f0/);
  assert.match(yaml, /github\.sha == inputs\.expected_controller_sha/);
  assert.match(yaml, /github\.run_attempt == 1/);
  assert.match(yaml, /contents: read/);
  assert.equal((yaml.match(/persist-credentials: false/g) ?? []).length, 2);
  assert.doesNotMatch(yaml, /\bsecrets\.|environment:|workflow_call:|pull_request:|\bpush:|continue-on-error:|--bundles|release:windows|tauri build/);
  assert.match(yaml, /cargo check --locked[^\n]*--all-targets/);
  assert.match(yaml, /cargo test --locked[^\n]*--lib/);
  const upload = yaml.slice(yaml.indexOf('path: |'));
  assert.doesNotMatch(upload, /\.exe|\.zip|target\/|release-output|\*\*/);
});
