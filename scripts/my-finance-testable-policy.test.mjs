import { describe, expect, it } from 'vitest';
import { CONFIG, PolicyError, validateContext, validateSourceAncestry, validateRun, validateEnvironment, validateApproval } from './my-finance-testable-policy.mjs';
const controller = '74b800aa2ab4c609d9274133d61b94d0c3016799';
const human = (id) => ({ id, type: 'User', login: id === CONFIG.operatorId ? CONFIG.operatorLogin : `reviewer-${id}` });
const context = () => ({ repository: CONFIG.repository, eventName: 'workflow_dispatch', ref: 'refs/heads/main',
  workflowRef: `${CONFIG.repository}/${CONFIG.workflow}@refs/heads/main`, workflowSha: controller,
  controllerSha: controller, githubSha: controller, runnerEnvironment: 'github-hosted', runnerOs: 'Windows', runId: '123', runAttempt: '1' });
const comparison = () => ({ status: 'ahead', ahead_by: 2, behind_by: 0,
  base_commit: { sha: CONFIG.sourceSha }, merge_base_commit: { sha: CONFIG.sourceSha },
  commits: [{ sha: '1'.repeat(40) }, { sha: controller }] });
const run = () => ({ id: 123, run_attempt: 1, head_sha: controller, event: 'workflow_dispatch', head_branch: 'main',
  path: CONFIG.workflow, repository: { full_name: CONFIG.repository }, actor: human(CONFIG.operatorId), triggering_actor: human(CONFIG.operatorId) });
const environment = () => ({ id: 5, name: CONFIG.environment, can_admins_bypass: false,
  protection_rules: [{ type: 'required_reviewers', prevent_self_review: false, reviewers: [{ type: 'User', reviewer: human(CONFIG.operatorId) }] }],
  deployment_branch_policy: { custom_branch_policies: true, protected_branches: false } });
const policies = () => ({ total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] });
const digest = 'a'.repeat(64);
const review = () => ({ state: 'approved', user: human(CONFIG.operatorId), environments: [{ id: 5, name: CONFIG.environment }],
  comment: `QA27 run=123 attempt=1 artifact=456 manifest=${digest}` });
const deny = (fn, code) => { expect(fn).toThrow(PolicyError); expect(fn).toThrow(code); };

describe('fixed TESTABLE controller policy', () => {
  it('allows manual main controller while fixing candidate source separately', () => {
    const result = validateContext(context());
    expect(result.sourceSha).toBe(CONFIG.sourceSha);
    expect(result.controllerSha).not.toBe(result.sourceSha);
  });
  it.each([
    ['repository', 'other/repo', 'context_repository'], ['eventName', 'pull_request', 'context_event_ref'],
    ['ref', 'refs/heads/feature', 'context_event_ref'], ['workflowRef', `${CONFIG.repository}/${CONFIG.workflow}@refs/heads/evil`, 'context_workflow'],
    ['workflowSha', CONFIG.sourceSha, 'context_controller'], ['controllerSha', CONFIG.sourceSha, 'context_controller'],
    ['githubSha', CONFIG.sourceSha, 'context_controller'], ['runnerEnvironment', 'self-hosted', 'context_runner'],
    ['runnerOs', 'Linux', 'context_runner'], ['runId', '', 'context_run'], ['runAttempt', '0', 'context_run'], ['runAttempt', '2', 'context_rerun'],
  ])('rejects context field %s mismatch', (key, value, code) => deny(() => validateContext({ ...context(), [key]: value }), code));
  it('pins the integrated main source', () => {
    expect(CONFIG.sourceSha).toBe('0807f2e7ee12780795df1b6d4b0fe3c5e2da593b');
  });
  it('accepts a controller descended from the fixed integrated source', () => {
    expect(validateSourceAncestry(comparison(), controller)).toEqual({ sourceSha: CONFIG.sourceSha, controllerSha: controller });
  });
  it.each([
    (c) => { c.status = 'diverged'; }, (c) => { c.ahead_by = 0; }, (c) => { c.behind_by = 1; },
    (c) => { c.base_commit.sha = '2'.repeat(40); }, (c) => { c.merge_base_commit.sha = '2'.repeat(40); },
    (c) => { c.commits.at(-1).sha = '2'.repeat(40); }, (c) => { c.commits = []; },
  ])('rejects a controller outside the trusted main lineage %#', (mutate) => {
    const value = comparison(); mutate(value);
    deny(() => validateSourceAncestry(value, controller), 'source_ancestry');
  });
  it('accepts actual run/controller identity', () => expect(validateRun(run(), context()).id).toBe(123));
  it.each([
    ['id', 124], ['run_attempt', 2], ['head_sha', CONFIG.sourceSha], ['event', 'push'],
    ['head_branch', 'feature/my-finance-phase2'], ['path', 'other.yml'], ['actor', { id: 1 }], ['triggering_actor', { ...human(2), type: 'Bot' }],
    ['repository', {}], ['actor', human(4)], ['triggering_actor', human(4)],
    ['actor', { ...human(CONFIG.operatorId), login: 'wrong-login' }],
  ])('rejects run field %s mismatch', (key, value) => expect(() => validateRun({ ...run(), [key]: value }, context())).toThrow(PolicyError));
  it('accepts explicit protected environment', () => expect(validateEnvironment(environment(), policies()).id).toBe(5));
  it.each([
    (e) => { delete e.can_admins_bypass; }, (e) => { e.can_admins_bypass = true; },
    (e) => { e.protection_rules = []; }, (e) => { e.protection_rules[0].prevent_self_review = true; },
    (e) => { e.protection_rules[0].reviewers = []; }, (e) => { e.protection_rules[0].reviewers[0].type = 'Team'; },
    (e) => { e.deployment_branch_policy.custom_branch_policies = false; },
    (e) => { delete e.protection_rules[0].prevent_self_review; },
    (e) => { e.protection_rules[0].reviewers[0].reviewer = human(4); },
    (e) => { e.protection_rules[0].reviewers.push(e.protection_rules[0].reviewers[0]); },
    (e) => { e.protection_rules.push(e.protection_rules[0]); },
  ])('rejects incomplete environment %#', (mutate) => { const value = environment(); mutate(value); expect(() => validateEnvironment(value, policies())).toThrow(PolicyError); });
  it('rejects wildcard environment branches', () => deny(() => validateEnvironment(environment(), { total_count: 1, branch_policies: [{ name: '*', type: 'branch' }] }), 'environment_branches'));
  it('records explicit single-operator approval of exact attempt artifact and manifest', () => {
    expect(validateApproval([review()], environment(), run(), context(), '456', digest)).toMatchObject({
      actor: CONFIG.operatorLogin, id: String(CONFIG.operatorId), artifactId: '456', runAttempt: '1', transferSha256: digest,
      approvalModel: 'single-operator, two explicit actions', independentApproval: false,
    });
  });
  it.each([
    (r) => { r.state = 'rejected'; }, (r) => { r.comment = 'approved'; }, (r) => { r.comment = r.comment.replace('attempt=1', 'attempt=2'); },
    (r) => { r.comment = r.comment.replace('artifact=456', 'artifact=789'); },
    (r) => { r.comment = r.comment.replace(digest, 'b'.repeat(64)); },
    (r) => { r.user = human(1); }, (r) => { r.user = human(2); },
    (r) => { r.user = human(4); }, (r) => { r.user.type = 'Bot'; }, (r) => { r.environments[0].id = 6; },
    (r) => { r.environments[0].name = 'other'; }, (r) => { delete r.user; },
  ])('rejects stale or unauthorized human approval %#', (mutate) => {
    const value = review(); mutate(value);
    deny(() => validateApproval([value], environment(), run(), context(), '456', digest), 'approval_missing');
  });
  it('rejects missing approval', () => deny(() => validateApproval([], environment(), run(), context(), '456', digest), 'approval_missing'));
});
