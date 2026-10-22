import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SOURCE, isAllowedControllerPath, validateDispatch, verifyDiagnostics } from './desktop-surface-c2d2.mjs';

const sha = 'a'.repeat(40);
const valid = {
  repository: 'school-health-hub/BOGUNON_DESK', event: 'workflow_dispatch',
  ref: 'refs/heads/feature/dashboard-mint-ivory-v2', attempt: '1', runnerOs: 'Windows',
  sha, expected: sha, workflowSha: sha,
  workflowRef: 'school-health-hub/BOGUNON_DESK/.github/workflows/desktop-surface-c2d2-runtime.yml@refs/heads/feature/dashboard-mint-ivory-v2',
  confirmation: 'RUN_C2D2_ONCE',
};

test('admits only exact one-shot Windows dispatch identity', () => {
  assert.doesNotThrow(() => validateDispatch(valid));
  for (const [key, value] of Object.entries({ event: 'push', attempt: '2', runnerOs: 'Linux', confirmation: 'yes' })) {
    assert.throws(() => validateDispatch({ ...valid, [key]: value }));
  }
});

test('immutable C-2D-1 source and controller allowlist are fixed', () => {
  assert.equal(SOURCE, '97dd7116a0844f86414812946b446cbbfdb5a209');
  assert.equal(isAllowedControllerPath('src-surface-host/src/runtime_guard.rs'), true);
  assert.equal(isAllowedControllerPath('src-tauri/src/lib.rs'), false);
  assert.equal(isAllowedControllerPath('.github/workflows/desktop-surface-c2c2-native.yml'), false);
});

test('diagnostic allowlist rejects executable and sensitive path evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'c2d2-contract-'));
  try {
    writeFileSync(join(root, 'runtime-summary.json'), '{"result":"BLOCKED"}\n');
    assert.doesNotThrow(() => verifyDiagnostics(root));
    writeFileSync(join(root, 'host.exe'), 'x');
    assert.throws(() => verifyDiagnostics(root));
    rmSync(join(root, 'host.exe'));
    writeFileSync(join(root, 'timeline.jsonl'), JSON.stringify({ path: 'C:\\Users\\secret' }));
    assert.throws(() => verifyDiagnostics(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('workflow is protected, non-retrying, source-pinned and diagnostic-only', () => {
  const yaml = readFileSync(new URL('../.github/workflows/desktop-surface-c2d2-runtime.yml', import.meta.url), 'utf8');
  assert.match(yaml, /environment: desktop-surface-runtime-qa/);
  assert.match(yaml, /ref: 97dd7116a0844f86414812946b446cbbfdb5a209/);
  assert.match(yaml, /github\.run_attempt == 1/);
  assert.match(yaml, /cancel-in-progress: false/);
  assert.match(yaml, /timeout-minutes:/);
  assert.match(yaml, /contents: read/);
  assert.match(yaml, /required_reviewers/);
  assert.match(yaml, /can_admins_bypass -ne \$false/);
  assert.match(yaml, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(yaml, /continue-on-error:|strategy:|matrix:|pull_request:|\bpush:/);
  const upload = yaml.slice(yaml.indexOf('uses: actions/upload-artifact'));
  assert.doesNotMatch(upload, /\.exe|\.zip|target|release-output|\*\*/i);
  assert.match(upload, /runtime-summary\.json/);
});
