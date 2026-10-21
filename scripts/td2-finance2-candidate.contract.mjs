import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateContext, BRANCH } from './td2-finance2-candidate.mjs';
const sha = 'a'.repeat(40);
const valid = { GITHUB_REPOSITORY: 'school-health-hub/BOGUNON_DESK', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: `refs/heads/${BRANCH}`, GITHUB_WORKFLOW_REF: `school-health-hub/BOGUNON_DESK/.github/workflows/td2-finance2-candidate.yml@refs/heads/${BRANCH}`,
  GITHUB_RUN_ATTEMPT: '1', EXPECTED_SOURCE_SHA: sha, GITHUB_SHA: sha, GITHUB_WORKFLOW_SHA: sha,
  RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Windows' };
test('allows reviewed candidate context without executing build', () => assert.doesNotThrow(() => validateContext(valid)));
for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: 'fork/other', GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/heads/main',
  GITHUB_WORKFLOW_REF: 'other', GITHUB_RUN_ATTEMPT: '2', EXPECTED_SOURCE_SHA: 'b'.repeat(40), GITHUB_WORKFLOW_SHA: 'c'.repeat(40),
  RUNNER_ENVIRONMENT: 'self-hosted', RUNNER_OS: 'Linux' })) {
  test(`rejects invalid ${key}`, () => assert.throws(() => validateContext({ ...valid, [key]: value })));
}
test('workflow has manual-only entry and no deployment privileges', () => {
  const s = fs.readFileSync('.github/workflows/td2-finance2-candidate.yml', 'utf8');
  assert.match(s, /on:\r?\n  workflow_dispatch:/);
  assert.doesNotMatch(s, /pull_request:|push:|schedule:|secrets\.|environment:|release:publish|release:updater|TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(s, /persist-credentials: false/);
  assert.match(s, /run: npm run release:windows/);
  assert.match(s, /path: diagnostics\/\*\.json/);
  assert.doesNotMatch(s, /continue-on-error|testTimeout|--testTimeout/);
});
test('unknown historical timeout does not replace or bypass mandatory suites', () => {
  const workflow = fs.readFileSync('.github/workflows/td2-finance2-candidate.yml', 'utf8');
  const helper = fs.readFileSync('scripts/td2-finance2-candidate.mjs', 'utf8');
  assert.doesNotMatch(workflow + helper, /TIMEOUT_TEST_|timeout_test_|timeoutCase/);
  assert.match(helper, /historicalFinanceTimeout: 'UNKNOWN'/);
  for (const command of ['npm test -- src/my-finance --maxWorkers=4', 'npm test -- --maxWorkers=4',
    'npx tsc --noEmit', 'npm run build', 'cargo test --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc my_finance',
    'npm run release:windows']) assert.ok(workflow.includes(`run: ${command}`), command);
  assert.match(workflow, /if: \$\{\{ success\(\) \}\}[\s\S]*?path: \|\r?\n\s+release-output\/BOGUNON-DESK-0\.2\.2-Windows-x64-Setup\.exe/);
  assert.match(workflow, /if: \$\{\{ failure\(\) \}\}[\s\S]*?path: diagnostics\/\*\.json/);
  assert.doesNotMatch(workflow, /continue-on-error|testTimeout|--testTimeout|--retry|always\(\)/);
});
test('actionlint archive and version are pinned before dependencies', () => {
  const workflow = fs.readFileSync('.github/workflows/td2-finance2-candidate.yml', 'utf8');
  assert.match(workflow, /releases\/download\/v1\.7\.12\/actionlint_1\.7\.12_windows_amd64\.zip/);
  assert.match(workflow, /6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9/);
  assert.match(workflow, /Get-FileHash -LiteralPath \$archive -Algorithm SHA256/);
  assert.match(workflow, /if \(\$actual -cne \$expected\) \{ throw/);
  assert.match(workflow, /if \(\$LASTEXITCODE -ne 0\) \{ throw 'actionlint failed' \}/);
  assert.ok(workflow.indexOf('name: Verify pinned actionlint and lint workflow') < workflow.indexOf('run: npm ci'));
});
test('application version and patched dependency lock are coherent', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json')); const lock = JSON.parse(fs.readFileSync('package-lock.json'));
  const tauri = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json'));
  assert.equal(pkg.version, '0.2.2'); assert.equal(lock.version, pkg.version); assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(tauri.version, pkg.version); assert.equal(tauri.identifier, 'kr.sungandi.schoolhealthdesk');
  assert.equal(lock.packages['node_modules/vite'].version, '8.3.3'); assert.equal(lock.packages['node_modules/source-map-js'].version, '1.2.2');
  assert.match(fs.readFileSync('src-tauri/Cargo.toml', 'utf8'), /version = "0\.2\.2"/);
  assert.match(fs.readFileSync('src-tauri/Cargo.lock', 'utf8'), /name = "school-health-desk"\r?\nversion = "0\.2\.2"/);
});
