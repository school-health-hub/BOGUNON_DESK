import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SOURCE = 'e2b73675c8662990024e69bfa12e060cc68a9440';
const REPOSITORY = 'school-health-hub/BOGUNON_DESK';
const REF = 'refs/heads/feature/dashboard-mint-ivory-v2';
const WORKFLOW = `${REPOSITORY}/.github/workflows/desktop-surface-c2c2-native.yml@${REF}`;
const read = (path) => readFileSync(path, 'utf8');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

export function validateDispatch(context) {
  assert.equal(context.repository, REPOSITORY);
  assert.equal(context.event, 'workflow_dispatch');
  assert.equal(context.ref, REF);
  assert.equal(context.attempt, '1');
  assert.match(context.expected, /^[a-f0-9]{40}$/);
  assert.equal(context.sha, context.expected);
  assert.equal(context.workflowSha, context.sha);
  assert.equal(context.workflowRef, WORKFLOW);
}

export function isAllowedControllerPath(path) {
  return path === '.github/workflows/desktop-surface-c2c2-native.yml'
    || path.startsWith('scripts/desktop-surface-c2c2')
    || path.startsWith('qa/c2c2-acl/')
    || path === 'docs/DESKTOP_SURFACE_C2C2_CI.md';
}

export function inventory(root) {
  const names = (relative) => {
    const url = new URL(relative, root instanceof URL ? root : pathToFileURL(`${resolve(root)}/`));
    const matches = [...read(url).matchAll(/generate_handler!\[([\s\S]*?)\]/g)];
    assert.equal(matches.length, 1, 'one explicit handler inventory required');
    return matches[0][1].split(',').map((name) => name.trim()).filter(Boolean)
      .map((name) => name.split('::').at(-1)).sort();
  };
  const production = names('src-tauri/src/lib.rs');
  const qa = names('src-tauri/src/my_finance_qa.rs');
  const all = [...new Set([...production, ...qa])].sort();
  assert.equal(production.length, 61);
  assert.equal(new Set(production).size, 61);
  assert.equal(qa.length, 12);
  assert.equal(new Set(qa).size, 12);
  assert.equal(all.length, 62);
  return { production, qa, all };
}

export function verifyResolverLocks(source, harness) {
  const packages = (text) => new Map(text.split('[[package]]').slice(1).map((block) => {
    const field = (name) => block.match(new RegExp(`^${name} = "([^"]+)"`, 'm'))?.[1];
    return [field('name'), { version: field('version'), checksum: field('checksum') }];
  }).filter(([name]) => name?.startsWith('tauri')));
  const expected = packages(source);
  const actual = packages(harness);
  for (const name of ['tauri', 'tauri-utils', 'tauri-codegen', 'tauri-macros', 'tauri-build']) {
    assert.ok(actual.has(name), `missing resolver ${name}`);
  }
  for (const [name, value] of actual) {
    assert.deepEqual(value, expected.get(name), `resolver lock differs: ${name}`);
  }
}

function sourceIdentity(source) {
  assert.equal(git(source, 'rev-parse', 'HEAD'), SOURCE);
  git(source, 'diff', '--exit-code');
  git(source, 'diff', '--cached', '--exit-code');
}

function guard(controller, source) {
  validateDispatch({
    repository: process.env.GITHUB_REPOSITORY,
    event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    sha: process.env.GITHUB_SHA,
    expected: process.env.EXPECTED_CONTROLLER_SHA,
    workflowSha: process.env.C2C2_WORKFLOW_SHA,
    workflowRef: process.env.C2C2_WORKFLOW_REF,
  });
  assert.equal(git(controller, 'rev-parse', 'HEAD'), process.env.GITHUB_SHA);
  assert.equal(git(controller, 'status', '--porcelain'), '');
  assert.equal(git(source, 'status', '--porcelain'), '');
  sourceIdentity(source);
  git(controller, 'merge-base', '--is-ancestor', SOURCE, 'HEAD');
  const changed = git(controller, 'diff', '--name-only', SOURCE, 'HEAD').split(/\r?\n/).filter(Boolean);
  assert.ok(changed.length > 0);
  for (const path of changed) {
    assert.ok(isAllowedControllerPath(path), `non-verifier controller delta: ${path}`);
  }
  verifyResolverLocks(
    read(join(source, 'src-tauri/Cargo.lock')),
    read(join(controller, 'qa/c2c2-acl/Cargo.lock')),
  );
  console.log(JSON.stringify({ controller: process.env.GITHUB_SHA, source: SOURCE, changed }));
}

function prepare(source, configuration) {
  assert.ok(['production', 'finance-qa'].includes(configuration));
  assert.ok(process.env.GITHUB_ENV);
  sourceIdentity(source);
  const lines = ['TAURI_ENV_TARGET_TRIPLE=x86_64-pc-windows-msvc'];
  if (configuration === 'finance-qa') {
    lines.push(`TAURI_CONFIG=${JSON.stringify(JSON.parse(read(join(source, 'src-tauri/tauri.my-finance-qa.conf.json'))))}`);
    lines.push(`BOGUNON_QA_SOURCE_SHA=${SOURCE}`);
  } else {
    assert.equal(process.env.TAURI_CONFIG, undefined);
    assert.equal(process.env.BOGUNON_QA_SOURCE_SHA, undefined);
  }
  appendFileSync(process.env.GITHUB_ENV, `${lines.join('\n')}\n`);
}

function collect(controller, source, configuration, output) {
  assert.ok(['production', 'finance-qa'].includes(configuration));
  sourceIdentity(source);
  const metadata = JSON.parse(execFileSync('cargo', [
    'metadata', '--locked', '--no-deps', '--format-version', '1',
    '--manifest-path', join(source, 'src-tauri/Cargo.toml'),
  ], { encoding: 'utf8' }));
  const manifest = join(source, 'src-tauri/Cargo.toml');
  const app = metadata.packages.find((pkg) => realpathSync(pkg.manifest_path) === realpathSync(manifest));
  assert.ok(app, 'source package metadata missing');
  const records = read(join(output, 'cargo-check.jsonl')).split(/\r?\n/).filter(Boolean)
    .map((line) => JSON.parse(line));
  const dirs = [...new Set(records
    .filter((record) => record.reason === 'build-script-executed' && record.package_id === app.id)
    .map((record) => record.out_dir))];
  assert.equal(dirs.length, 1, 'ambiguous/missing source build output');
  const out = dirs[0];
  const files = ['acl-manifests.json', 'capabilities.json'];
  const hashes = Object.fromEntries(files.map((name) => [name, hash(join(out, name))]));
  const input = {
    ...inventory(source),
    configuration,
    source: SOURCE,
    controller: process.env.GITHUB_SHA,
    run: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    generatedHashes: hashes,
  };
  mkdirSync(output, { recursive: true });
  const inputPath = join(output, 'inventory.json');
  writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);
  for (const name of files) writeFileSync(join(output, name), readFileSync(join(out, name)));
  assert.ok(process.env.GITHUB_ENV);
  appendFileSync(process.env.GITHUB_ENV, [
    `C2C2_SOURCE_ROOT=${source}`,
    `C2C2_SOURCE_OUT_DIR=${out}`,
    `C2C2_INVENTORY=${inputPath}`,
    `C2C2_REPORT=${join(output, 'C2C2-ACL-REPORT.json')}`,
    '',
  ].join('\n'));
  verifyResolverLocks(
    read(join(source, 'src-tauri/Cargo.lock')),
    read(join(controller, 'qa/c2c2-acl/Cargo.lock')),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, controllerArg, sourceArg, configuration, outputArg] = process.argv.slice(2);
  const controller = resolve(controllerArg ?? '.');
  const source = resolve(sourceArg ?? '.');
  switch (mode) {
    case 'guard': guard(controller, source); break;
    case 'prepare': prepare(source, configuration); break;
    case 'collect': collect(controller, source, configuration, resolve(outputArg)); break;
    default: throw new Error('Expected guard, prepare or collect with controller/source paths');
  }
}
