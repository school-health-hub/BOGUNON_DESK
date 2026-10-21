import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const BRANCH = 'release/td2-finance2-candidate';
export const FINANCE = 'dc6772c996cad0d8dbfba5f6f7afb505f817fdb8';
const fail = (condition, message) => { if (!condition) throw new Error(message); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
export function validateContext(e) {
  fail(e.GITHUB_REPOSITORY === 'school-health-hub/BOGUNON_DESK', 'Repository rejected');
  fail(e.GITHUB_EVENT_NAME === 'workflow_dispatch', 'Manual dispatch only');
  fail(e.GITHUB_REF === `refs/heads/${BRANCH}`, 'Candidate branch required');
  fail(e.GITHUB_WORKFLOW_REF === `school-health-hub/BOGUNON_DESK/.github/workflows/td2-finance2-candidate.yml@refs/heads/${BRANCH}`, 'Workflow identity rejected');
  fail(e.GITHUB_RUN_ATTEMPT === '1', 'New approved dispatch required; rerun rejected');
  fail(/^[a-f0-9]{40}$/.test(e.EXPECTED_SOURCE_SHA ?? '') && e.EXPECTED_SOURCE_SHA === e.GITHUB_SHA, 'Exact reviewed SHA required');
  fail(e.GITHUB_WORKFLOW_SHA === e.GITHUB_SHA, 'Controller/source mismatch');
  fail(e.RUNNER_ENVIRONMENT === 'github-hosted' && e.RUNNER_OS === 'Windows', 'Disposable Windows runner required');
  fail(/^src\/[A-Za-z0-9_./-]+\.test\.(tsx?|mjs)$/.test(e.TIMEOUT_TEST_FILE ?? '') && !e.TIMEOUT_TEST_FILE.split('/').includes('..'), 'Tracked timeout test path required');
  fail(typeof e.TIMEOUT_TEST_NAME === 'string' && e.TIMEOUT_TEST_NAME.trim().length > 0 && e.TIMEOUT_TEST_NAME.length < 600, 'Exact original timeout test name required');
}
function guard() {
  validateContext(process.env);
  fail(git('rev-parse', 'HEAD') === process.env.GITHUB_SHA, 'Checkout SHA mismatch');
  fail(git('status', '--porcelain') === '', 'Checkout must be clean');
  git('merge-base', '--is-ancestor', FINANCE, 'HEAD');
  fail(git('ls-files', '--', process.env.TIMEOUT_TEST_FILE) === process.env.TIMEOUT_TEST_FILE, 'Untracked timeout case');
  const pkg = read('package.json'); const lock = read('package-lock.json'); const tauri = read('src-tauri/tauri.conf.json');
  fail(pkg.version === '0.2.2' && lock.version === pkg.version && lock.packages[''].version === pkg.version && tauri.version === pkg.version, 'Version mismatch');
  fail(tauri.identifier === 'kr.sungandi.schoolhealthdesk', 'Operating identifier required');
  fail(lock.packages['node_modules/vite'].version === '8.3.3' && lock.packages['node_modules/source-map-js'].version === '1.2.2', 'Dependency patches missing');
  fail(!process.env.TAURI_CONFIG && !process.env.TAURI_SIGNING_PRIVATE_KEY, 'Config/signing overrides rejected');
}
function timeoutCase() {
  validateContext(process.env);
  const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  fail(fs.existsSync(npm), 'Node setup npm CLI missing');
  const escaped = process.env.TIMEOUT_TEST_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  execFileSync(process.execPath, [npm, 'exec', '--', 'vitest', 'run', process.env.TIMEOUT_TEST_FILE,
    '--testNamePattern', `^${escaped}$`, '--maxWorkers=1', '--reporter=json', '--outputFile=diagnostics/timeout.json'], { stdio: 'inherit' });
  const report = read('diagnostics/timeout.json');
  fail(report.success === true && report.numPassedTests === 1 && report.numFailedTests === 0, 'Exactly one timeout regression must pass');
}
function manifest() {
  validateContext(process.env);
  const dir = 'release-output';
  const names = fs.readdirSync(dir).filter(n => n.endsWith('.exe'));
  fail(names.length === 1 && names[0] === 'BOGUNON-DESK-0.2.2-Windows-x64-Setup.exe', 'Unexpected installer');
  const bytes = fs.readFileSync(path.join(dir, names[0]));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  fail(fs.readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8').trim() === `${sha256}  ${names[0]}`, 'Installer checksum mismatch');
  const signature = read('diagnostics/authenticode.json');
  fail(['NotSigned', 'Valid'].includes(signature.status), 'Unexpected Authenticode status');
  const value = { schemaVersion: 1, version: '0.2.2', identifier: 'kr.sungandi.schoolhealthdesk',
    sourceSha: process.env.GITHUB_SHA, controllerSha: process.env.GITHUB_WORKFLOW_SHA,
    financeBaseline: FINANCE, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
    installer: { fileName: names[0], bytes: bytes.length, sha256, authenticodeStatus: signature.status },
    timeoutCase: { file: process.env.TIMEOUT_TEST_FILE, name: process.env.TIMEOUT_TEST_NAME },
    productionDeployment: false, installationApproved: false, completedChecks: 'All prior required job steps succeeded' };
  fs.writeFileSync(path.join(dir, 'BUILD-MANIFEST.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  // Replace generic legacy reset advice in the candidate package, not the shared packager.
  fs.writeFileSync(path.join(dir, 'README-FIRST.txt'), 'BOGUNON DESK 0.2.2 candidate\nRead TD2_FINANCE2_CANDIDATE.md. Installation requires separate approval.\nDo not delete AppData, finance.db, key.dpapi, authentication, settings or backups.\nRequire final workflow completed/success and matching source/run/attempt/hash before use.\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  switch (process.argv[2]) {
    case 'guard': guard(); break;
    case 'timeout': timeoutCase(); break;
    case 'manifest': manifest(); break;
    default: throw new Error('Expected guard, timeout or manifest');
  }
}
