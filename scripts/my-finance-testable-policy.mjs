export const CONFIG = Object.freeze({
  repository: 'school-health-hub/BOGUNON_DESK',
  operatorId: 281109297,
  operatorLogin: 'sungandi86-max',
  approvalModel: 'single-operator, two explicit actions',
  sourceSha: 'c6f11974822e06a7855314575551983ea6dadcef',
  branch: 'feature/my-finance-phase1',
  pr: 14,
  operatingSha: '5cec64358436c148710499b5aa9d2e78c34e0136',
  environment: 'my-finance-testable-publish',
  workflow: '.github/workflows/my-finance-qa-testable.yml',
});
export class PolicyError extends Error {
  constructor(code) { super(code); this.name = 'PolicyError'; this.code = code; }
}
function requirePolicy(condition, code) { if (!condition) throw new PolicyError(code); }
const decimal = (value) => (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value)))
  && /^(?:[1-9][0-9]*)$/.test(String(value));
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const operator = (value) => user(value) && value.id === CONFIG.operatorId && value.login === CONFIG.operatorLogin;
const user = (value) => value?.type === 'User' && Number.isSafeInteger(value.id)
  && value.id > 0 && typeof value.login === 'string' && /^[a-zA-Z0-9-]+$/.test(value.login);

export function validateContext(ctx) {
  requirePolicy(ctx?.repository === CONFIG.repository, 'context_repository');
  requirePolicy(ctx.eventName === 'workflow_dispatch' && ctx.ref === 'refs/heads/main', 'context_event_ref');
  requirePolicy(ctx.workflowRef === `${CONFIG.repository}/${CONFIG.workflow}@refs/heads/main`, 'context_workflow');
  requirePolicy(sha(ctx.workflowSha) && ctx.workflowSha === ctx.controllerSha
    && ctx.controllerSha === ctx.githubSha, 'context_controller');
  requirePolicy(ctx.runnerEnvironment === 'github-hosted' && ctx.runnerOs === 'Windows', 'context_runner');
  requirePolicy(decimal(ctx.runId) && decimal(ctx.runAttempt), 'context_run');
  requirePolicy(String(ctx.runAttempt) === '1', 'context_rerun');
  return Object.freeze({ ...ctx, sourceSha: CONFIG.sourceSha, runId: String(ctx.runId), runAttempt: String(ctx.runAttempt) });
}
export function validatePr(pr) {
  requirePolicy(pr?.number === CONFIG.pr && pr.state === 'open' && pr.draft === true, 'pr_state');
  requirePolicy(pr.base?.ref === 'main' && pr.base?.repo?.full_name === CONFIG.repository, 'pr_base');
  requirePolicy(pr.head?.repo?.full_name === CONFIG.repository && pr.head.repo.fork === false, 'pr_repository');
  requirePolicy(pr.head?.ref === CONFIG.branch && pr.head?.sha === CONFIG.sourceSha, 'pr_source');
  return Object.freeze({ number: CONFIG.pr, sha: CONFIG.sourceSha, branch: CONFIG.branch });
}
export function validateRun(run, ctx) {
  requirePolicy(decimal(run?.id) && String(run.id) === String(ctx.runId)
    && decimal(run.run_attempt) && String(run.run_attempt) === '1'
    && String(run.run_attempt) === String(ctx.runAttempt), 'run_identity');
  requirePolicy(run.head_sha === ctx.controllerSha && run.event === 'workflow_dispatch'
    && run.head_branch === 'main', 'run_controller');
  requirePolicy([CONFIG.workflow, `${CONFIG.workflow}@refs/heads/main`].includes(run.path)
    && run.repository?.full_name === CONFIG.repository, 'run_workflow');
  requirePolicy(operator(run.actor) && operator(run.triggering_actor), 'run_actor');
  return run;
}
export function validateEnvironment(env, policies) {
  requirePolicy(env?.name === CONFIG.environment && Number.isSafeInteger(env.id) && env.id > 0, 'environment_identity');
  requirePolicy(env.can_admins_bypass === false, 'environment_bypass');
  requirePolicy(Array.isArray(env.protection_rules), 'environment_review');
  const reviewers = env.protection_rules.filter((rule) => rule?.type === 'required_reviewers');
  requirePolicy(reviewers?.length === 1 && reviewers[0].prevent_self_review === false, 'environment_review');
  requirePolicy(Array.isArray(reviewers[0].reviewers) && reviewers[0].reviewers.length === 1
    && reviewers[0].reviewers.every((entry) => entry?.type === 'User' && operator(entry.reviewer)), 'environment_reviewers');
  requirePolicy(env.deployment_branch_policy?.custom_branch_policies === true
    && env.deployment_branch_policy.protected_branches === false, 'environment_branch_mode');
  requirePolicy(policies?.total_count === 1 && policies.branch_policies?.length === 1
    && policies.branch_policies[0].name === 'main' && policies.branch_policies[0].type === 'branch', 'environment_branches');
  return env;
}
export function validateApproval(reviews, env, run, ctx, artifactId, transferSha) {
  requirePolicy(decimal(artifactId) && /^[a-f0-9]{64}$/.test(transferSha), 'approval_binding');
  const comment = `QA27 run=${ctx.runId} attempt=${ctx.runAttempt} artifact=${artifactId} manifest=${transferSha}`;
  requirePolicy(Array.isArray(reviews) && Array.isArray(env.protection_rules), 'approval_missing');
  const reviewerRules = env.protection_rules.filter((rule) => rule?.type === 'required_reviewers');
  requirePolicy(reviewerRules.length === 1 && reviewerRules[0].prevent_self_review === false, 'approval_missing');
  const configured = reviewerRules[0].reviewers;
  requirePolicy(Array.isArray(configured), 'approval_missing');
  requirePolicy(operator(run.actor) && operator(run.triggering_actor) && String(ctx.runAttempt) === '1', 'approval_actor');
  requirePolicy(configured.length === 1 && configured[0]?.type === 'User' && operator(configured[0].reviewer), 'approval_missing');
  const accepted = reviews.filter((review) => review?.state === 'approved' && review.comment === comment
    && operator(review.user) && configured.some((entry) => entry?.type === 'User' && entry.reviewer?.id === review.user.id)
    && review.user.id === run.actor.id && review.user.id === run.triggering_actor.id
    && Array.isArray(review.environments) && review.environments.some((item) => item?.id === env.id && item.name === CONFIG.environment));
  requirePolicy(Array.isArray(accepted) && accepted.length > 0, 'approval_missing');
  const approved = accepted[accepted.length - 1];
  return Object.freeze({ actor: approved.user.login, id: String(approved.user.id),
    environmentId: env.id, runId: String(ctx.runId), runAttempt: String(ctx.runAttempt),
    artifactId: String(artifactId), transferSha256: transferSha, environment: CONFIG.environment, comment,
    approvalModel: CONFIG.approvalModel, independentApproval: false });
}
