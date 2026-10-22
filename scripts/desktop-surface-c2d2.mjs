import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE = '97dd7116a0844f86414812946b446cbbfdb5a209';
const REPOSITORY = 'school-health-hub/BOGUNON_DESK';
const REF = 'refs/heads/feature/dashboard-mint-ivory-v2';
const WORKFLOW = `${REPOSITORY}/.github/workflows/desktop-surface-c2d2-runtime.yml@${REF}`;
const ALLOWED_DIAGNOSTICS = new Set([
  'runtime-summary.json',
  'timeline.jsonl',
  'ownership-ledger.json',
  'udf-observation.json',
  'cleanup-receipt.json',
  'cleanup-unknown.json',
]);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();

export function validateDispatch(context) {
  assert.equal(context.repository, REPOSITORY);
  assert.equal(context.event, 'workflow_dispatch');
  assert.equal(context.ref, REF);
  assert.equal(context.attempt, '1');
  assert.equal(context.runnerOs, 'Windows');
  assert.match(context.expected, /^[a-f0-9]{40}$/);
  assert.equal(context.sha, context.expected);
  assert.equal(context.workflowSha, context.sha);
  assert.equal(context.workflowRef, WORKFLOW);
  assert.equal(context.confirmation, 'RUN_C2D2_ONCE');
}

export function isAllowedControllerPath(path) {
  return path === '.github/workflows/desktop-surface-c2d2-runtime.yml'
    || path === 'docs/DESKTOP_SURFACE_C2D2_RUNTIME_QA.md'
    || path.startsWith('scripts/desktop-surface-c2d2')
    || path === 'src-surface-host/Cargo.toml'
    || path === 'src-surface-host/Cargo.lock'
    || path.startsWith('src-surface-host/src/runtime_')
    || path === 'src-surface-host/src/lib.rs'
    || path === 'src-surface-host/src/windows_host.rs'
    || path === 'src-surface-host/src/bin/c2d2-runtime-qa.rs'
    || path === 'src-surface-host/tests/runtime_contract.rs';
}

export function verifyDiagnostics(root) {
  const files = readdirSync(root, { withFileTypes: true });
  assert.ok(files.length > 0, 'diagnostic directory is empty');
  for (const entry of files) {
    assert.equal(entry.isFile(), true, `nested diagnostic path denied: ${entry.name}`);
    assert.equal(ALLOWED_DIAGNOSTICS.has(entry.name), true, `diagnostic denied: ${entry.name}`);
    assert.ok(statSync(join(root, entry.name)).size <= 1024 * 1024, `diagnostic too large: ${entry.name}`);
    const text = readFileSync(join(root, entry.name), 'utf8');
    assert.doesNotMatch(text, /[a-z]:[\\/]+users[\\/]+|AppData|cookie|credential|password|finance\.db|key\.dpapi/i);
  }
}

function guard(controller, source) {
  validateDispatch({
    repository: process.env.GITHUB_REPOSITORY,
    event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    runnerOs: process.env.RUNNER_OS,
    sha: process.env.GITHUB_SHA,
    expected: process.env.EXPECTED_CONTROLLER_SHA,
    workflowSha: process.env.C2D2_WORKFLOW_SHA,
    workflowRef: process.env.C2D2_WORKFLOW_REF,
    confirmation: process.env.C2D2_CONFIRMATION,
  });
  assert.equal(git(controller, 'rev-parse', 'HEAD'), process.env.GITHUB_SHA);
  assert.equal(git(source, 'rev-parse', 'HEAD'), SOURCE);
  assert.equal(git(controller, 'status', '--porcelain'), '');
  assert.equal(git(source, 'status', '--porcelain'), '');
  git(controller, 'merge-base', '--is-ancestor', SOURCE, 'HEAD');
  const changed = git(controller, 'diff', '--name-only', SOURCE, 'HEAD').split(/\r?\n/).filter(Boolean);
  assert.ok(changed.length > 0);
  for (const path of changed) assert.equal(isAllowedControllerPath(path), true, `controller delta denied: ${path}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, first, second] = process.argv.slice(2);
  if (mode === 'guard') guard(resolve(first), resolve(second));
  else if (mode === 'diagnostics') verifyDiagnostics(resolve(first));
  else throw new Error('Expected guard <controller> <source> or diagnostics <directory>');
}
