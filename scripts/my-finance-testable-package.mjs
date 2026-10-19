import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SOURCE = 'c6f11974822e06a7855314575551983ea6dadcef';
export const OPERATING = '5cec64358436c148710499b5aa9d2e78c34e0136';
export const INSTALLER = 'BOGUNON-DESK-MY-FINANCE-QA-c6f1197-Windows-x64-Setup.exe';
export const ORIGINAL = [INSTALLER, 'SHA256SUMS.txt', 'QA-TEST-STATUS.json', 'START-HERE.ko.md'];
export const TRANSFER_FILES = [...ORIGINAL, 'ISOLATION.json'];
export const PACKAGE_FILES = [...TRANSFER_FILES, 'TRANSFER.json'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
export function parseContext(value) {
  requireValue(value?.sourceSha === SOURCE, 'Unapproved source');
  requireValue(/^[a-f0-9]{40}$/.test(value.controllerSha), 'Invalid controller SHA');
  for (const key of ['runId', 'runAttempt']) requireValue(typeof value[key] === 'string' && /^[1-9][0-9]*$/.test(value[key]), `Invalid ${key}`);
  return { sourceSha: SOURCE, controllerSha: value.controllerSha, runId: value.runId, runAttempt: value.runAttempt };
}
function evidence(value, context) {
  requireValue(value?.status === 'passed' && value.sourceSha === SOURCE, 'Isolation failed/source mismatch');
  requireValue(value.workflowRunId === context.runId && value.workflowRunAttempt === context.runAttempt, 'Stale run evidence');
  requireValue(value.operatingReferenceSha === OPERATING, 'Operating reference mismatch');
  for (const key of ['fullOperatingTreePreservedWhenClosed', 'operatingFinancialDataPreservedWhileRunning', 'simultaneousExecution', 'operatingNeverUninstalled', 'qaUninstallPreservedBothFinancialStores', 'outboundBlockedInDisposableRunner']) requireValue(value[key] === true, `Isolation flag missing: ${key}`);
  requireValue(['NotSigned', 'Valid'].includes(value.authenticodeStatus), 'Signature status rejected');
  requireValue(/^[a-f0-9]{64}$/.test(value.sha256), 'Installer digest missing');
}
async function readRegular(file, max = 2 * 1024 * 1024) {
  const stat = await fs.lstat(file);
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= max, 'Invalid package file');
  return fs.readFile(file);
}
async function exactDirectory(dir, names) {
  const stat = await fs.lstat(dir);
  requireValue(stat.isDirectory() && !stat.isSymbolicLink(), 'Invalid package directory');
  const actual = (await fs.readdir(dir)).sort();
  requireValue(JSON.stringify(actual) === JSON.stringify([...names].sort()), 'Unexpected package inventory');
}
async function payload(dir, context) {
  const files = {};
  for (const name of TRANSFER_FILES) files[name] = await readRegular(path.join(dir, name), name === INSTALLER ? 512 * 1024 * 1024 : undefined);
  const isolation = parse(files['ISOLATION.json']);
  const status = parse(files['QA-TEST-STATUS.json']);
  evidence(isolation, context);
  evidence(status, context);
  requireValue(status.testable === true && status.productionDeployment === false && status.fileName === INSTALLER, 'TESTABLE manifest rejected');
  const installerSha256 = digest(files[INSTALLER]);
  requireValue(isolation.sha256 === installerSha256 && status.sha256 === installerSha256, 'Installer differs from tested bytes');
  // Preserve the exact checksum line emitted by the pinned packager.
  requireValue(files['SHA256SUMS.txt'].toString('utf8') === `${installerSha256}  ${INSTALLER}${String.fromCharCode(10)}`, 'Checksum manifest mismatch');
  return { files, installerSha256 };
}
export async function prepare(dir, evidenceFile, expected) {
  const context = parseContext(expected);
  await exactDirectory(dir, ORIGINAL);
  const isolation = await readRegular(evidenceFile);
  evidence(parse(isolation), context);
  await fs.writeFile(path.join(dir, 'ISOLATION.json'), isolation, { flag: 'wx' });
  const checked = await payload(dir, context);
  const hashes = Object.fromEntries(TRANSFER_FILES.map(name => [name, digest(checked.files[name])]));
  const transfer = { schemaVersion: 1, ...context, installerSha256: checked.installerSha256, files: hashes };
  await fs.writeFile(path.join(dir, 'TRANSFER.json'), `${JSON.stringify(transfer, null, 2)}\n`, { flag: 'wx' });
  return verify(dir, context);
}
export async function verify(dir, expected) {
  const context = parseContext(expected);
  await exactDirectory(dir, PACKAGE_FILES);
  const checked = await payload(dir, context);
  const transferBytes = await readRegular(path.join(dir, 'TRANSFER.json'));
  const transfer = parse(transferBytes);
  requireValue(transfer.schemaVersion === 1, 'Transfer schema mismatch');
  for (const [key, value] of Object.entries(context)) requireValue(transfer[key] === value, `Transfer ${key} mismatch`);
  requireValue(transfer.installerSha256 === checked.installerSha256, 'Transfer installer mismatch');
  requireValue(JSON.stringify(Object.keys(transfer.files ?? {}).sort()) === JSON.stringify([...TRANSFER_FILES].sort()), 'Transfer inventory mismatch');
  for (const name of TRANSFER_FILES) requireValue(transfer.files[name] === digest(checked.files[name]), `Transferred bytes changed: ${name}`);
  const transferSha256 = digest(transferBytes);
  if (expected.transferSha256 !== undefined) requireValue(expected.transferSha256 === transferSha256, 'Expected transfer digest mismatch');
  return { transferSha256, installerSha256: checked.installerSha256, files: { ...checked.files, 'TRANSFER.json': transferBytes } };
}
export async function publish(dir, expected, approval, outDir) {
  const checked = await verify(dir, expected);
  requireValue(typeof approval?.actor === 'string' && approval.actor.length > 0 && /^[1-9][0-9]*$/.test(String(approval.id)) && /^[1-9][0-9]*$/.test(String(approval.artifactId)), 'Publication approval missing');
  requireValue(approval.transferSha256 === checked.transferSha256, 'Approval bound to different transfer');
  requireValue(approval.runId === expected.runId && approval.runAttempt === expected.runAttempt, 'Approval run mismatch');
  if (expected.artifactId !== undefined) requireValue(String(approval.artifactId) === String(expected.artifactId), 'Approval artifact mismatch');
  await fs.mkdir(outDir);
  for (const name of PACKAGE_FILES) {
    const bytes = checked.files[name];
    await fs.writeFile(path.join(outDir, name), bytes, { flag: 'wx' });
  }
  const publication = { schemaVersion: 1, ...parseContext(expected), installerSha256: checked.installerSha256, transferSha256: checked.transferSha256, approval, trustModel: 'Trusted pinned candidate; evidence is a validation record, not tamper-proof independent security proof', productionDeployment: false };
  await fs.writeFile(path.join(outDir, 'PUBLICATION.json'), `${JSON.stringify(publication, null, 2)}\n`, { flag: 'wx' });
  return publication;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [command, dir, contextOrEvidence, contextOrApproval, output] = process.argv.slice(2);
    switch (command) {
      case 'prepare': await prepare(dir, contextOrEvidence, parse(await readRegular(contextOrApproval))); break;
      case 'verify': await verify(dir, parse(await readRegular(contextOrEvidence))); break;
      case 'publish': await publish(dir, parse(await readRegular(contextOrEvidence)), parse(await readRegular(contextOrApproval)), output); break;
      default: throw new Error('Usage: package.mjs prepare <dir> <isolation> <context> | verify <dir> <context> | publish <dir> <context> <approval> <out>');
    }
  } catch (error) { console.error(error instanceof Error ? error.message : 'Package validation failed'); process.exitCode = 1; }
}
