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
  'case-report.json',
  'retention-observation.json',
  'phase-one-receipt.json',
  'phase-two-summary.json',
  'evidence-validation.json',
  'cancellation-request.json',
]);
export const FAILURE_CASES = Object.freeze([
  'environment-rejected', 'controller-rejected', 'environment-deadline', 'controller-deadline',
  'cancel-before-controller', 'held-event-token', 'held-com-reference', 'missing-browser-exit',
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
    || path === 'src-surface-host/src/browser_exit.rs'
    || path === 'src-surface-host/src/native_window.rs'
    || path === 'src-surface-host/tests/runtime_contract.rs'
    || path === 'src-surface-host/tests/runtime_deadline_contract.rs';
}

export function verifyDiagnostics(root) {
  let total = 0;
  const scan = (directory, nested = false) => {
    const files = readdirSync(directory, { withFileTypes: true });
    assert.ok(files.length > 0, 'diagnostic directory is empty');
    for (const entry of files) {
      assert.equal(entry.isSymbolicLink(), false, 'diagnostic link denied');
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        assert.equal(nested, false, 'nested case directory denied');
        assert.ok(FAILURE_CASES.includes(entry.name), 'unknown case directory');
        scan(path, true);
        continue;
      }
      assert.equal(entry.isFile(), true, 'non-file diagnostic denied');
      assert.ok(ALLOWED_DIAGNOSTICS.has(entry.name), 'unknown diagnostic file');
      const size = statSync(path).size;
      assert.ok(size <= 1024 * 1024, 'diagnostic too large');
      total += size;
      assert.ok(total <= 8 * 1024 * 1024, 'diagnostic total exceeds limit');
      const text = readFileSync(path, 'utf8');
      if (/[a-z]:[/]+users[/]+|AppData|cookie|credential|password|finance[.]db|key[.]dpapi/i.test(text.split(String.fromCharCode(92)).join('/'))) throw new Error('sensitive diagnostic denied');
      const records = entry.name.endsWith('.jsonl') ? text.trim().split(String.fromCharCode(10)) : [text];
      for (const record of records) {
        let value;
        try { value = JSON.parse(record); } catch { throw new Error('invalid diagnostic record'); }
        inspectValue(value);
      }
    }
  };
  scan(root);
}

function inspectValue(value) {
  if (typeof value === 'string') {
    const normalized = value.split(String.fromCharCode(92)).join('/');
    if (/[a-z]:[/]|[/]{2}[^/]|[/](?:Users|home)[/]|Bearer +|gh[pousr]_[a-z0-9]{20,}|github_pat_|BEGIN .*PRIVATE KEY/i.test(normalized)) throw new Error('sensitive diagnostic denied');
  } else if (Array.isArray(value)) {
    for (const item of value) inspectValue(item);
  } else if (value && typeof value === 'object') {
    for (const [key,item] of Object.entries(value)) {
      if (/^(?:password|credential|cookie|accessToken|refreshToken|authorization|privateKey)$/i.test(key)) throw new Error('sensitive diagnostic denied');
      inspectValue(item);
    }
  }
}

export function evidenceStatus(root) {
  try {
    const summary = JSON.parse(readFileSync(join(root,'runtime-summary.json'),'utf8'));
    if (summary.schema !== 2 || summary.evidenceState !== 'COMPLETE' || summary.phaseOneResult !== 'PASS') return 'INCOMPLETE';
    const phase = JSON.parse(readFileSync(join(root,'phase-two-summary.json'),'utf8'));
    if (phase.cases.length !== FAILURE_CASES.length) return 'INCOMPLETE';
    for (const id of FAILURE_CASES) {
      const report = JSON.parse(readFileSync(join(root,id,'case-report.json'),'utf8'));
      if (report.caseId !== id || report.evidenceComplete !== true) return 'INCOMPLETE';
    }
    return 'COMPLETE';
  } catch { return 'INCOMPLETE'; }
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
  const changed = git(controller, 'diff', '--name-only', SOURCE, 'HEAD').split(String.fromCharCode(10)).map(line => line.trim()).filter(Boolean);
  assert.ok(changed.length > 0);
  for (const path of changed) assert.equal(isAllowedControllerPath(path), true, `controller delta denied: ${path}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
  const [mode, first, second] = process.argv.slice(2);
  if (mode === 'guard') guard(resolve(first), resolve(second));
  else if (mode === 'diagnostics') {
    verifyDiagnostics(resolve(first));
    // Complete safety scan and complete runtime evidence are different facts.
    console.log(JSON.stringify({diagnosticSafetyScan:'PASSED_LIMITED_PATTERNS',evidenceState:evidenceStatus(resolve(first))}));
  }
  else throw new Error('Expected guard <controller> <source> or diagnostics <directory>');
  } catch {
    console.error('C-2D-2 validation failed; input details withheld');
    process.exitCode = 1;
  }
}
