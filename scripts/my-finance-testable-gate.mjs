// Controller-only API checks; never execute candidate code in the publisher.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CONFIG, validateContext, validateSourceAncestry, validateRun, validateEnvironment, validateApproval } from './my-finance-testable-policy.mjs';

async function api(path) {
  if (!process.env.GH_TOKEN) throw new Error('API_TOKEN_MISSING');
  const response = await fetch(`https://api.github.com/repos/${CONFIG.repository}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  if (!response.ok) throw new Error('API_REQUEST_FAILED');
  return response.json();
}
function context() {
  const e = process.env;
  const controllerSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('CONTROLLER_DIRTY');
  return validateContext({ repository: e.GITHUB_REPOSITORY, eventName: e.GITHUB_EVENT_NAME, ref: e.GITHUB_REF,
    workflowRef: e.GITHUB_WORKFLOW_REF, workflowSha: e.GITHUB_WORKFLOW_SHA, githubSha: e.GITHUB_SHA,
    controllerSha, runnerEnvironment: e.RUNNER_ENVIRONMENT, runnerOs: e.RUNNER_OS,
    runId: e.GITHUB_RUN_ID, runAttempt: e.GITHUB_RUN_ATTEMPT });
}
export async function check(ctx, api) {
  const comparison = await api(`compare/${CONFIG.sourceSha}...${ctx.controllerSha}`);
  validateSourceAncestry(comparison, ctx.controllerSha);
  const run = await api(`actions/runs/${ctx.runId}/attempts/${ctx.runAttempt}`);
  validateRun(run, ctx);
  const environment = await api(`environments/${CONFIG.environment}`);
  const policies = await api(`environments/${CONFIG.environment}/deployment-branch-policies?per_page=100`);
  validateEnvironment(environment, policies);
  return { run, environment };
}
export async function gate(mode, input, artifactId, transferSha256, api) {
let ctx = { ...validateContext(input) };
const { run, environment } = await check(ctx, api);
let approval;
if (mode === 'publish-check') {
  if (!/^[1-9][0-9]*$/.test(artifactId ?? '') || !/^[a-f0-9]{64}$/.test(transferSha256 ?? '')) throw new Error('INVALID_TRANSFER_ID');
  const artifact = await api(`actions/artifacts/${artifactId}`);
  const expected = `MY-FINANCE-QA-CANDIDATE-${ctx.runId}-${ctx.runAttempt}`;
  if (String(artifact.id) !== artifactId || artifact.name !== expected || artifact.expired !== false ||
      String(artifact.workflow_run?.id) !== ctx.runId || artifact.workflow_run?.head_sha !== ctx.controllerSha ||
      artifact.workflow_run?.head_branch !== 'main' || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '')) throw new Error('ARTIFACT_BINDING_FAILED');
  const jobs = await api(`actions/runs/${ctx.runId}/attempts/${ctx.runAttempt}/jobs?per_page=100`);
  if (!Array.isArray(jobs.jobs) || jobs.total_count !== jobs.jobs.length ||
      jobs.jobs.filter(j => j.name === 'Validate pinned candidate' && j.status === 'completed' && j.conclusion === 'success').length !== 1) throw new Error('CANDIDATE_NOT_SUCCESSFUL');
  const reviews = await api(`actions/runs/${ctx.runId}/approvals`);
  approval = validateApproval(reviews, environment, run, ctx, artifactId, transferSha256);
  Object.assign(ctx, { artifactId, transferSha256, candidateArtifactDigest: artifact.digest });

} else if (mode !== 'check') throw new Error('INVALID_MODE');
return { context: ctx, approval };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, contextPath, artifactId, transferSha256, approvalPath] = process.argv.slice(2);
  const result = await gate(mode, context(), artifactId, transferSha256, api);
  if (result.approval) await fs.writeFile(approvalPath, JSON.stringify(result.approval, null, 2), { flag: 'wx' });
  await fs.writeFile(contextPath, JSON.stringify(result.context, null, 2), { flag: 'wx' });
  console.log('PINNED_QA_GATE_PASSED');
}
