// Build-only entry. Never launches the resulting executable.
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { finderHomeQaPaths, prepareFinderHomeQaPaths, finderHomeQaEnvironment, projectRoot, identifier } from './finder-home-qa-paths.mjs';

const expected = process.env.FINDER_QA_EXPECTED_SOURCE_SHA;
const git = args => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CI !== 'true'
    || !/^[a-f0-9]{40}$/.test(expected ?? '') || git(['rev-parse', 'HEAD']) !== expected
    || git(['status', '--porcelain']) !== '') throw new Error('Clean pinned CI checkout required.');
const paths = prepareFinderHomeQaPaths(finderHomeQaPaths());
const env = { ...finderHomeQaEnvironment(paths), BOGUNON_FINDER_HOME_QA_SOURCE_SHA: expected,
  CARGO_BUILD_JOBS: '1', CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_NET_OFFLINE: 'true' };
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: projectRoot, env, stdio: 'inherit', windowsHide: true, timeout: 3600000 });
  if (result.error || result.status !== 0) throw new Error('Finder QA build step failed; no fallback or app launch.');
}
run(process.execPath, ['scripts/build-finder-home-qa-frontend.mjs']);
const stamp = JSON.parse(readFileSync(join(paths.dist, 'qa-build.json'), 'utf8'));
if (stamp.sourceSha !== expected || stamp.sourceDirty !== false || stamp.externalConnections !== false) throw new Error('Frontend provenance mismatch.');
const config = JSON.parse(readFileSync(join(projectRoot, 'src-tauri/tauri.finder-home-qa.conf.json'), 'utf8'));
const distReference = relative(join(projectRoot, 'src-tauri'), paths.dist).replaceAll('\\', '/');
if (isAbsolute(distReference) || distReference.includes(':')) throw new Error('Build source and dist must be on the same drive.');
config.build.frontendDist = distReference;
env.TAURI_CONFIG = JSON.stringify(config);
run('cargo', ['build', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--offline',
  '--target', 'x86_64-pc-windows-msvc', '--bin', 'school-health-desk', '--features', 'finder-home-qa,tauri/custom-protocol']);
if (git(['status', '--porcelain']) !== '') throw new Error('Build changed source or lockfiles.');
const executable = join(paths.target, 'x86_64-pc-windows-msvc/debug/school-health-desk.exe');
const bytes = readFileSync(executable);
if (bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Not a PE executable.');
const offset = bytes.readUInt32LE(0x3c);
if (offset + 6 > bytes.length || bytes.toString('ascii', offset, offset + 4) !== 'PE\0\0'
    || bytes.readUInt16LE(offset + 4) !== 0x8664) throw new Error('Expected Windows x64 PE.');
if (!bytes.includes(Buffer.from(expected)) || !bytes.includes(Buffer.from(identifier))) throw new Error('Embedded source/identity missing.');
const artifact = join(paths.root, 'artifact');
mkdirSync(artifact, { recursive: false });
const name = 'bogunon-desk-finder-home-qa.exe';
copyFileSync(executable, join(artifact, name));
const sha256 = createHash('sha256').update(bytes).digest('hex');
writeFileSync(join(artifact, 'SOURCE_SHA.txt'), `${expected}\n`, { flag: 'wx' });
writeFileSync(join(artifact, 'ARTIFACT-MANIFEST.json'), `${JSON.stringify({ schema: 1,
  sourceSha: expected, identifier, executable: name, sha256, sizeBytes: bytes.length,
  runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  workflowSha: process.env.FINDER_QA_WORKFLOW_SHA, platform: 'windows-x64',
  appExecution: 'NOT RUN', syntheticOnly: true, externalConnections: false,
  installer: false, signed: false }, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ sourceSha: expected, sha256, appExecution: 'NOT RUN' }));
