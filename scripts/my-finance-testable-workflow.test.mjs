import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync('.github/workflows/my-finance-qa-testable.yml', 'utf8');
describe.each([['LF', '\n'], ['CRLF', '\r\n']])('manual TESTABLE workflow wiring (%s)', (_name, newline) => {
  // Check every original contract after normalizing only the checkout line endings.
  const workflow = source.replace(/\r?\n/g, newline).replace(/\r\n/g, '\n');
  const [candidate, publisher] = workflow.split('\n  publisher:');
  const steps = publisher.split('\n      - ');
  it('exposes exactly one manual trigger and no external inputs', () => {
    expect(workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1]).toBe('  workflow_dispatch:\n');
    expect(workflow).not.toMatch(/inputs:|pull_request:|push:|schedule:|workflow_call:/);
  });
  it('uses two separate hosted Windows jobs and read-only API permissions', () => {
    expect(workflow.match(/^  [a-z-]+:\n/gm)).toHaveLength(2);
    expect(workflow.match(/runs-on: windows-latest/g)).toHaveLength(2);
    expect(workflow).toContain('contents: read\n  pull-requests: read\n  actions: read');
    expect(workflow).not.toMatch(/self-hosted|: write|secrets\.|overwrite:|release:windows/);
  });
  it('guards both jobs by repository, main and manual event', () => {
    expect(workflow.match(/github\.repository == 'school-health-hub\/BOGUNON_DESK'/g)).toHaveLength(2);
    expect(workflow.match(/github\.ref == 'refs\/heads\/main'/g)).toHaveLength(2);
    expect(publisher).toContain("needs.candidate.result == 'success'");
    expect(workflow.match(/github[.]run_attempt == 1/g)).toHaveLength(2);
  });
  it('checks controller before checking out fixed candidate without saved credentials', () => {
    expect(candidate.indexOf('my-finance-testable-gate.mjs check')).toBeLessThan(candidate.indexOf('ref: daab156c5ac0e340574593990fc9d230d574e9a1'));
    expect(candidate).toContain('ref: 5cec64358436c148710499b5aa9d2e78c34e0136');
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(4);
  });
  it('keeps native isolation and cleanup before candidate packaging', () => {
    for (const command of ['npm test -- --maxWorkers=4', 'cargo test --locked', 'QA feature requires QA config', 'QA config requires QA feature', 'dumpbin /dependents', 'windows-my-finance-isolation.ps1']) expect(candidate).toContain(command);
    expect(candidate.indexOf('windows-my-finance-isolation.ps1')).toBeLessThan(candidate.indexOf('node scripts/package-my-finance-qa.mjs'));
    expect(candidate.indexOf('my-finance-testable-package.mjs prepare')).toBeLessThan(candidate.indexOf('id: transfer-upload'));
  });
  it('transfers the exact artifact ID and manifest hash across jobs', () => {
    expect(candidate).toContain('artifact-id: ${{ steps.transfer-upload.outputs.artifact-id }}');
    expect(candidate).toContain('transfer-sha256: ${{ steps.transfer-hash.outputs.sha256 }}');
    expect(publisher).toContain('artifact-ids: ${{ needs.candidate.outputs.artifact-id }}');
    expect(publisher).toContain('TRANSFER_SHA: ${{ needs.candidate.outputs.transfer-sha256 }}');
    expect(candidate).toContain('MY-FINANCE-QA-CANDIDATE-${{ github.run_id }}-${{ github.run_attempt }}');
  });
  it('publisher executes only controller gates/package validators and requires protected human approval', () => {
    expect(publisher).toContain('environment: my-finance-testable-publish');
    expect(publisher).not.toMatch(/npm ci|npm run|cargo |isolation\.ps1|ref: c6|Start-Process/);
    expect(publisher.match(/my-finance-testable-gate.mjs publish-check/g)).toHaveLength(2);
    const final = steps.findIndex(s => s.startsWith('name: Final PR'));
    expect(steps[final + 1]).toContain('name: Upload approved synthetic QA TESTABLE only');
  });
  it('uploads exact six candidate and seven final paths without release globs', () => {
    const transferPaths = candidate.match(/path: \|\n([\s\S]*?)\n          if-no-files-found: error/)?.[1];
    const finalPaths = publisher.match(/path: \|\n([\s\S]*?)\n          if-no-files-found: error/)?.[1];
    expect(transferPaths.trim().split('\n')).toHaveLength(6);
    expect(finalPaths.trim().split('\n')).toHaveLength(7);
    expect(`${transferPaths}${finalPaths}`).not.toMatch(/\*|release-output|bundle\//);
    expect(finalPaths).toContain('PUBLICATION.json');
    expect(publisher).toContain("if: ${{ success() && github.event_name == 'workflow_dispatch' && needs.candidate.result == 'success' }}");
  });
  it('keeps failure Evidence separate from installer publication', () => {
    const failureUpload = candidate.slice(candidate.indexOf('name: Upload isolation evidence only'));
    expect(failureUpload).toContain('if: ${{ always() }}');
    expect(failureUpload).toContain('path: qa-source/artifacts/my-finance-qa-evidence/**');
    expect(failureUpload).not.toContain('.exe');
  });
  it('requires the second GitHub approval action after Candidate before publication', () => {
    expect(publisher).toContain('needs: candidate');
    expect(publisher).toContain('environment: my-finance-testable-publish');
    expect(publisher.indexOf('publish-check')).toBeLessThan(publisher.indexOf('my-finance-testable-package.mjs publish'));
    expect(candidate).toContain('QA27 run=');
    expect(candidate).toContain('no independent approval');
  });
  it('pins every external action to a full commit', () => {
    const actions = [...workflow.matchAll(/uses: ([^\n]+)/g)].map(m => m[1]);
    expect(actions.length).toBeGreaterThan(5);
    for (const action of actions) expect(action).toMatch(/^[\w-]+\/[\w-]+@[a-f0-9]{40}$/);
  });
});
