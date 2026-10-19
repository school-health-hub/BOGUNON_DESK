import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { INSTALLER, OPERATING, SOURCE, PACKAGE_FILES, prepare, publish, verify } from './my-finance-testable-package.mjs';
const roots = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qa24r-package-')); roots.push(root);
  const dir = path.join(root, 'ready'); await fs.mkdir(dir);
  const context = { sourceSha: SOURCE, controllerSha: 'a'.repeat(40), runId: '123', runAttempt: '2' };
  const bytes = Buffer.from('Synthetic fixture; not an executable');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const isolation = { status: 'passed', sourceSha: SOURCE, workflowRunId: '123', workflowRunAttempt: '2', operatingReferenceSha: OPERATING, sha256, authenticodeStatus: 'NotSigned', fullOperatingTreePreservedWhenClosed: true, operatingFinancialDataPreservedWhileRunning: true, simultaneousExecution: true, operatingNeverUninstalled: true, qaUninstallPreservedBothFinancialStores: true, outboundBlockedInDisposableRunner: true };
  await fs.writeFile(path.join(dir, INSTALLER), bytes);
  await fs.writeFile(path.join(dir, 'SHA256SUMS.txt'), `${sha256}  ${INSTALLER}\n`);
  await fs.writeFile(path.join(dir, 'QA-TEST-STATUS.json'), JSON.stringify({ ...isolation, fileName: INSTALLER, testable: true, productionDeployment: false }));
  await fs.writeFile(path.join(dir, 'START-HERE.ko.md'), 'Synthetic QA only');
  const evidenceFile = path.join(root, 'isolation.json'); await fs.writeFile(evidenceFile, JSON.stringify(isolation));
  return { root, dir, context, evidenceFile };
}
describe('TESTABLE package transfer', () => {
  it('prepares and independently verifies exact same bytes', async () => {
    const f = await fixture();
    const first = await prepare(f.dir, f.evidenceFile, f.context);
    expect((await verify(f.dir, f.context)).transferSha256).toBe(first.transferSha256);
    expect((await fs.readdir(f.dir)).sort()).toEqual([...PACKAGE_FILES].sort());
  });
  it.each(['sourceSha', 'controllerSha', 'runId', 'runAttempt'])('rejects mismatched context %s', async key => {
    const f = await fixture(); await prepare(f.dir, f.evidenceFile, f.context);
    await expect(verify(f.dir, { ...f.context, [key]: key.endsWith('Sha') ? 'b'.repeat(40) : '9' })).rejects.toThrow();
  });
  it.each(['simultaneousExecution', 'operatingNeverUninstalled', 'qaUninstallPreservedBothFinancialStores', 'outboundBlockedInDisposableRunner', 'operatingFinancialDataPreservedWhileRunning'])('rejects false or missing isolation %s', async key => {
    const f = await fixture(); const value = JSON.parse(await fs.readFile(f.evidenceFile, 'utf8')); value[key] = false;
    await fs.writeFile(f.evidenceFile, JSON.stringify(value));
    await expect(prepare(f.dir, f.evidenceFile, f.context)).rejects.toThrow();
  });
  it('rejects altered installer after candidate validation', async () => {
    const f = await fixture(); await prepare(f.dir, f.evidenceFile, f.context);
    await fs.writeFile(path.join(f.dir, INSTALLER), 'altered');
    await expect(verify(f.dir, f.context)).rejects.toThrow('Installer differs');
  });
  it('rejects extra files and directories', async () => {
    const f = await fixture(); await prepare(f.dir, f.evidenceFile, f.context); await fs.mkdir(path.join(f.dir, 'release-output'));
    await expect(verify(f.dir, f.context)).rejects.toThrow('inventory');
  });
  it('rejects manifest claiming production deployment', async () => {
    const f = await fixture(); const file = path.join(f.dir, 'QA-TEST-STATUS.json');
    const value = JSON.parse(await fs.readFile(file, 'utf8')); value.productionDeployment = true; await fs.writeFile(file, JSON.stringify(value));
    await expect(prepare(f.dir, f.evidenceFile, f.context)).rejects.toThrow('manifest');
  });
  it('requires explicit bound approval and publishes exact inventory', async () => {
    const f = await fixture(); const checked = await prepare(f.dir, f.evidenceFile, f.context);
    const approval = { actor: 'human-reviewer', id: '55', artifactId: '77', transferSha256: checked.transferSha256, runId: '123', runAttempt: '2' };
    const out = path.join(f.root, 'published'); await publish(f.dir, f.context, approval, out);
    expect((await fs.readdir(out)).sort()).toEqual([...PACKAGE_FILES, 'PUBLICATION.json'].sort());
    expect(await fs.readFile(path.join(out, INSTALLER))).toEqual(await fs.readFile(path.join(f.dir, INSTALLER)));
    await expect(publish(f.dir, f.context, approval, out)).rejects.toThrow();
  });
  it.each(['transferSha256', 'runId', 'runAttempt'])('rejects approval mismatch %s', async key => {
    const f = await fixture(); const checked = await prepare(f.dir, f.evidenceFile, f.context);
    const approval = { actor: 'human-reviewer', id: '55', artifactId: '77', transferSha256: checked.transferSha256, runId: '123', runAttempt: '2', [key]: 'wrong' };
    await expect(publish(f.dir, f.context, approval, path.join(f.root, 'out'))).rejects.toThrow();
  });
});
