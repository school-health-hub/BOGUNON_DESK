import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateContext, BRANCH } from './td2-finance2-candidate.mjs';
const sha = 'a'.repeat(40);
const valid = { GITHUB_REPOSITORY: 'school-health-hub/BOGUNON_DESK', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: `refs/heads/${BRANCH}`, GITHUB_WORKFLOW_REF: `school-health-hub/BOGUNON_DESK/.github/workflows/td2-finance2-candidate.yml@refs/heads/${BRANCH}`,
  GITHUB_RUN_ATTEMPT: '1', EXPECTED_SOURCE_SHA: sha, GITHUB_SHA: sha, GITHUB_WORKFLOW_SHA: sha,
  RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Windows', TIMEOUT_TEST_FILE: 'src/my-finance/FinanceScreen.test.tsx', TIMEOUT_TEST_NAME: 'Synthetic contract case' };
test('allows reviewed candidate context without executing build', () => assert.doesNotThrow(() => validateContext(valid)));
for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: 'fork/other', GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/heads/main',
  GITHUB_WORKFLOW_REF: 'other', GITHUB_RUN_ATTEMPT: '2', EXPECTED_SOURCE_SHA: 'b'.repeat(40), GITHUB_WORKFLOW_SHA: 'c'.repeat(40),
  RUNNER_ENVIRONMENT: 'self-hosted', RUNNER_OS: 'Linux', TIMEOUT_TEST_FILE: 'src/../evil.test.ts', TIMEOUT_TEST_NAME: '' })) {
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
test('application version and patched dependency lock are coherent', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json')); const lock = JSON.parse(fs.readFileSync('package-lock.json'));
  const tauri = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json'));
  assert.equal(pkg.version, '0.2.2'); assert.equal(lock.version, pkg.version); assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(tauri.version, pkg.version); assert.equal(tauri.identifier, 'kr.sungandi.schoolhealthdesk');
  assert.equal(lock.packages['node_modules/vite'].version, '8.3.3'); assert.equal(lock.packages['node_modules/source-map-js'].version, '1.2.2');
  assert.match(fs.readFileSync('src-tauri/Cargo.toml', 'utf8'), /version = "0\.2\.2"/);
  assert.match(fs.readFileSync('src-tauri/Cargo.lock', 'utf8'), /name = "school-health-desk"\r?\nversion = "0\.2\.2"/);
});
