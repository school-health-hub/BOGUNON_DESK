import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync('docs/MY_FINANCE_TESTABLE_PUBLICATION.md', 'utf8');
describe.each([['LF', '\n'], ['CRLF', '\r\n']])('publication use contract (%s)', (_name, newline) => {
  const doc = source.replace(/\r?\n/g, newline).replace(/\r\n/g, '\n');
  it('distinguishes upload admission from final workflow status and retained artifacts', () => {
    expect(doc).toContain('success() checks upload-step admission, not the final workflow conclusion');
    expect(doc).toContain('upload completes -> cancellation or post-step failure -> artifact may remain');
    expect(doc).not.toContain('Failed/cancelled runs and cleanup failure cannot publish');
  });
  it('requires all identities and content checks before use', () => {
    const section = doc.split('## Mandatory manual checks before download, installation or transfer')[1]?.split('## Static verification')[0];
    expect(section).toBeDefined();
    for (const requirement of ['status = completed', 'conclusion = success', 'run ID', 'run attempt', 'controller SHA', 'source SHA', 'human approval', 'artifact ID', 'exact seven-file inventory', 'installer SHA-256', 'TRANSFER.json', 'PUBLICATION.json', 'QA-TEST-STATUS.json', 'SHA256SUMS.txt', 'ISOLATION.json']) expect(section).toContain(requirement);
    expect(section).toContain('latest run and the exact attempt');
    expect(section).toContain('DENY use even when the artifact exists');
  });
  it('documents post-upload failure and cancellation as deny cases', () => {
    const rows = doc.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
    for (const conclusion of ['failure', 'cancelled', 'timed_out', 'unknown']) expect(rows).toContainEqual(['completed', conclusion, 'DENY']);
    expect(rows).toContainEqual(['in_progress', 'any', 'DENY']);
    expect(rows).toContainEqual(['completed', 'success', 'Continue identity/approval/hash checks; not installation authorization']);
  });
  it('states single-operator policy and its reduced independence', () => {
    for (const text of ['single-operator, two explicit actions', '281109297', 'prevent_self_review=false', 'independentApproval=false', 'run_attempt=1']) expect(doc).toContain(text);
  });
  it('does not pretend the document is an automatic consumption gate', () => {
    expect(doc).toContain('No automatic pre-use final-status verifier exists in this change');
    expect(doc).toContain('Manual operator procedure only');
    expect(doc).toContain('A future read-only consumption verifier is follow-up work');
    expect(doc).toContain('does not authorize workflow dispatch, installation or forwarding');
  });
});
