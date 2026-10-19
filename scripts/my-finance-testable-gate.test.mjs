import { describe, expect, it } from 'vitest';
import { gate } from './my-finance-testable-gate.mjs';
import { CONFIG } from './my-finance-testable-policy.mjs';
const controller = '74b800aa2ab4c609d9274133d61b94d0c3016799';
const hash = 'a'.repeat(64);
const human = id => ({ id, type: 'User', login: `reviewer-${id}` });
function fixture() {
  const ctx = { repository: CONFIG.repository, eventName: 'workflow_dispatch', ref: 'refs/heads/main', workflowRef: `${CONFIG.repository}/${CONFIG.workflow}@refs/heads/main`, workflowSha: controller, githubSha: controller, controllerSha: controller, runnerEnvironment: 'github-hosted', runnerOs: 'Windows', runId: '123', runAttempt: '2' };
  const data = {
    'pulls/14': { number: 14, state: 'open', draft: true, base: { ref: 'main', repo: { full_name: CONFIG.repository } }, head: { sha: CONFIG.sourceSha, ref: CONFIG.branch, repo: { full_name: CONFIG.repository, fork: false } } },
    [`git/ref/heads/${CONFIG.branch}`]: { ref: `refs/heads/${CONFIG.branch}`, object: { type: 'commit', sha: CONFIG.sourceSha } },
    'actions/runs/123/attempts/2': { id: 123, run_attempt: 2, head_sha: controller, event: 'workflow_dispatch', head_branch: 'main', path: CONFIG.workflow, repository: { full_name: CONFIG.repository }, actor: human(1), triggering_actor: human(2) },
    [`environments/${CONFIG.environment}`]: { id: 5, name: CONFIG.environment, can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [{ type: 'User', reviewer: human(3) }] }], deployment_branch_policy: { custom_branch_policies: true, protected_branches: false } },
    [`environments/${CONFIG.environment}/deployment-branch-policies?per_page=100`]: { total_count: 1, branch_policies: [{ type: 'branch', name: 'main' }] },
    'actions/artifacts/456': { id: 456, name: 'MY-FINANCE-QA-CANDIDATE-123-2', expired: false, digest: `sha256:${hash}`, workflow_run: { id: 123, head_sha: controller, head_branch: 'main' } },
    'actions/runs/123/attempts/2/jobs?per_page=100': { total_count: 1, jobs: [{ name: 'Validate pinned candidate', status: 'completed', conclusion: 'success' }] },
    'actions/runs/123/approvals': [{ state: 'approved', user: human(3), environments: [{ id: 5, name: CONFIG.environment }], comment: `QA24R run=123 attempt=2 artifact=456 manifest=${hash}` }],
  };
  const calls = [];
  const api = async key => { calls.push(key); if (!(key in data)) throw new Error('API_UNAVAILABLE'); return data[key]; };
  return { ctx, data, calls, api };
}
describe('controller API gate integration', () => {
  it('preflight checks fixed PR, ref, attempt and real environment before candidate work', async () => {
    const f = fixture(); const result = await gate('check', f.ctx, undefined, undefined, f.api);
    expect(result.context.sourceSha).toBe(CONFIG.sourceSha); expect(result.approval).toBeUndefined(); expect(f.calls).toHaveLength(5);
  });
  it('publisher checks successful job, exact artifact and bound different human approval', async () => {
    const f = fixture(); const result = await gate('publish-check', f.ctx, '456', hash, f.api);
    expect(result.context.artifactId).toBe('456'); expect(result.approval.actor).toBe('reviewer-3'); expect(f.calls).toHaveLength(8);
  });
  it.each(['pulls/14', `environments/${CONFIG.environment}`, 'actions/runs/123/attempts/2'])('API failure %s stops without permit/output', async key => {
    const f = fixture(); delete f.data[key]; await expect(gate('check', f.ctx, undefined, undefined, f.api)).rejects.toThrow('API_UNAVAILABLE');
  });
  it.each([
    ['actions/artifacts/456', d => { d.workflow_run.head_sha = CONFIG.sourceSha; }],
    ['actions/artifacts/456', d => { d.expired = true; }],
    ['actions/artifacts/456', d => { d.name = 'MY-FINANCE-QA-TESTABLE'; }],
    ['actions/runs/123/attempts/2/jobs?per_page=100', d => { d.jobs[0].conclusion = 'cancelled'; }],
    ['actions/runs/123/attempts/2/jobs?per_page=100', d => { d.jobs[0].conclusion = 'failure'; }],
    ['actions/runs/123/attempts/2/jobs?per_page=100', d => { d.total_count = 101; }],
    ['actions/runs/123/approvals', d => { d[0].comment = 'approved'; }],
    [`git/ref/heads/${CONFIG.branch}`, d => { d.object.sha = controller; }],
  ])('publisher rejects changed metadata %#', async (key, mutate) => {
    const f = fixture(); mutate(f.data[key]); await expect(gate('publish-check', f.ctx, '456', hash, f.api)).rejects.toThrow();
  });
  it('automatic event stops before any API request', async () => {
    const f = fixture(); f.ctx.eventName = 'pull_request'; await expect(gate('check', f.ctx, undefined, undefined, f.api)).rejects.toThrow(); expect(f.calls).toHaveLength(0);
  });
});
