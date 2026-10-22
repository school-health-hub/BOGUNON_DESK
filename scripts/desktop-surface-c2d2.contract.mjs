import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { test } from 'node:test';
import { SOURCE, isAllowedControllerPath, validateDispatch, verifyDiagnostics, evidenceStatus } from './desktop-surface-c2d2.mjs';

const sha = 'a'.repeat(40);
const valid = {
  repository: 'school-health-hub/BOGUNON_DESK', event: 'workflow_dispatch',
  ref: 'refs/heads/feature/dashboard-mint-ivory-v2', attempt: '1', runnerOs: 'Windows',
  sha, expected: sha, workflowSha: sha,
  workflowRef: 'school-health-hub/BOGUNON_DESK/.github/workflows/desktop-surface-c2d2-runtime.yml@refs/heads/feature/dashboard-mint-ivory-v2',
  confirmation: 'RUN_C2D2_ONCE',
};

test('admits only exact one-shot Windows dispatch identity', () => {
  assert.doesNotThrow(() => validateDispatch(valid));
  for (const [key, value] of Object.entries({ event: 'push', attempt: '2', runnerOs: 'Linux', confirmation: 'yes' })) {
    assert.throws(() => validateDispatch({ ...valid, [key]: value }));
  }
});

test('immutable C-2D-1 source and controller allowlist are fixed', () => {
  assert.equal(SOURCE, '97dd7116a0844f86414812946b446cbbfdb5a209');
  assert.equal(isAllowedControllerPath('src-surface-host/src/runtime_guard.rs'), true);
  assert.equal(isAllowedControllerPath('src-tauri/src/lib.rs'), false);
  assert.equal(isAllowedControllerPath('.github/workflows/desktop-surface-c2c2-native.yml'), false);
});

test('diagnostic allowlist rejects executable and sensitive path evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'c2d2-contract-'));
  try {
    writeFileSync(join(root, 'runtime-summary.json'), '{"result":"BLOCKED"}\n');
    assert.doesNotThrow(() => verifyDiagnostics(root));
    writeFileSync(join(root, 'host.exe'), 'x');
    assert.throws(() => verifyDiagnostics(root));
    rmSync(join(root, 'host.exe'));
    writeFileSync(join(root, 'timeline.jsonl'), JSON.stringify({ path: ['C:', 'Users', 'secret'].join(String.fromCharCode(92)) }));
    assert.throws(() => verifyDiagnostics(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('workflow is protected, non-retrying, source-pinned and diagnostic-only', () => {
  const yaml = readFileSync(new URL('../.github/workflows/desktop-surface-c2d2-runtime.yml', import.meta.url), 'utf8');
  assert.match(yaml, /environment: desktop-surface-runtime-qa/);
  assert.match(yaml, /ref: 97dd7116a0844f86414812946b446cbbfdb5a209/);
  assert.match(yaml, /github\.run_attempt == 1/);
  assert.match(yaml, /cancel-in-progress: false/);
  assert.match(yaml, /timeout-minutes:/);
  assert.match(yaml, /contents: read/);
  assert.match(yaml, /required_reviewers/);
  assert.match(yaml, /can_admins_bypass -ne \$false/);
  assert.match(yaml, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(yaml, /continue-on-error:|strategy:|matrix:|pull_request:|\bpush:/);
  const upload = yaml.slice(yaml.indexOf('uses: actions/upload-artifact'));
  assert.doesNotMatch(upload, /\.exe|\.zip|target|release-output|\*\*/i);
  assert.match(upload, /runtime-summary\.json/);
});

test('case diagnostics accept LF/CRLF JSONL but reject unknown files and nested paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'c2d2-cases-'));
  const dir = join(root, 'controller-deadline');
  try {
    mkdirSync(dir);
    for (const newline of [String.fromCharCode(10), String.fromCharCode(13,10)]) {
      writeFileSync(join(dir, 'timeline.jsonl'), ['{"stage":"requested"}','{"stage":"closed"}'].join(newline));
      assert.doesNotThrow(() => verifyDiagnostics(root));
    }
    writeFileSync(join(dir,'host.exe'),'not an executable');
    assert.throws(() => verifyDiagnostics(root));
    rmSync(join(dir,'host.exe'));
    writeFileSync(join(dir,'timeline.jsonl'),'not JSON');
    assert.throws(() => verifyDiagnostics(root));
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('all case outputs are fixed diagnostic paths and scanner success gates upload', () => {
  const yaml=readFileSync(new URL('../.github/workflows/desktop-surface-c2d2-runtime.yml',import.meta.url),'utf8');
  assert.ok(yaml.includes("steps.diagnostics.outcome == 'success'"));
  for (const id of ['environment-rejected','controller-rejected','environment-deadline','controller-deadline','cancel-before-controller','held-event-token','held-com-reference','missing-browser-exit']) {
    assert.ok(yaml.includes(id+'/case-report.json'));
  }
  assert.equal(isAllowedControllerPath('src-surface-host/src/runtime_qa/child.rs'),true);
  assert.equal(isAllowedControllerPath('src-surface-host/src/browser_exit.rs'),true);
  assert.equal(isAllowedControllerPath('src-tauri/capabilities/default.json'),false);
});

test('partial evidence cannot be classified complete and secrets outside Users paths are denied', () => {
  const root=mkdtempSync(join(tmpdir(),'c2d2-privacy-'));
  try {
    writeFileSync(join(root,'runtime-summary.json'),JSON.stringify({schema:2,evidenceState:'INCOMPLETE'}));
    assert.equal(evidenceStatus(root),'INCOMPLETE');
    assert.doesNotThrow(()=>verifyDiagnostics(root));
    for(const value of [{path:'D:/private/cache'},{accessToken:'synthetic'},{path:'/home/synthetic/cache'}]) {
      writeFileSync(join(root,'runtime-summary.json'),JSON.stringify(value));
      assert.throws(()=>verifyDiagnostics(root));
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('supervisor is bounded, redacted and never retries or kills the child', () => {
  const suite=readFileSync(new URL('../src-surface-host/src/runtime_qa/suite.rs',import.meta.url),'utf8');
  const binary=readFileSync(new URL('../src-surface-host/src/bin/c2d2-runtime-qa.rs',import.meta.url),'utf8');
  assert.ok(suite.includes('runtime_budget::observe('));
  assert.ok(!suite.includes('child.wait();'));
  assert.ok(!suite.includes('child.kill('));
  assert.ok(binary.includes('inspect validated diagnostics'));
  assert.ok(!binary.includes('blocked: {error}'));
});

test('scanner CLI never echoes rejected secrets paths or malformed JSON', () => {
  const root=mkdtempSync(join(tmpdir(),'c2d2-redaction-'));
  const marker='SYNTHETIC_PRIVATE_MARKER_913';
  try {
    for(const record of [JSON.stringify({path:'D:/'+marker}),JSON.stringify({accessToken:marker}),'{'+marker]) {
      writeFileSync(join(root,'runtime-summary.json'),record);
      const result=spawnSync(process.execPath,['scripts/desktop-surface-c2d2.mjs','diagnostics',root],{encoding:'utf8'});
      assert.equal(result.status,1);
      assert.ok(!(result.stdout+result.stderr).includes(marker));
      assert.ok(!(result.stdout+result.stderr).includes(root));
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});

// Structural regression contract only; actionlint independently parses YAML/expressions.
function runtimePathInitialization(yaml) {
  const text=yaml.split(String.fromCharCode(13)).join('');
  const stepsAt=text.indexOf('    steps:');
  const jobEnv=text.slice(text.indexOf('    env:'),stepsAt);
  assert.ok(!jobEnv.includes('runner.'),'runner context is forbidden in job env');
  const name='      - name: Initialize isolated runtime paths';
  const start=text.indexOf(name,stepsAt);
  assert.ok(start>=stepsAt,'path initializer missing');
  assert.equal(text.slice(stepsAt+'    steps:'.length,start).trim(),'','initializer must be first step');
  const next=text.indexOf(String.fromCharCode(10)+'      - ',start+name.length);
  const block=text.slice(start,next);
  assert.ok(block.includes('working-directory: .'),'initializer cannot depend on checkout directory');
  const run=block.slice(block.indexOf('        run: |')+'        run: |'.length)
    .split(String.fromCharCode(10)).slice(1).map(line=>line.slice(10)).join(String.fromCharCode(10));
  assert.ok(run.includes('$env:RUNNER_TEMP'));
  assert.ok(run.includes('Add-Content -LiteralPath $env:GITHUB_ENV'));
  assert.ok(run.includes('$env:GITHUB_RUN_ID'));
  assert.ok(run.includes('$env:GITHUB_RUN_ATTEMPT'));
  for(const key of ['C2D2_DIAGNOSTICS','C2D2_PREFLIGHT_PATH','C2D2_UDF']){
    assert.ok(run.includes(key+' ='));
    assert.ok(!run.includes('$env:'+key),'GITHUB_ENV exports apply only to later steps');
    const firstUse=text.indexOf('$env:'+key);
    assert.ok(firstUse===-1||firstUse>next,'runtime path used before initialization');
  }
  return run;
}

test('runtime path initialization forbids job runner context and precedes every use for LF/CRLF',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/desktop-surface-c2d2-runtime.yml',import.meta.url),'utf8');
  for(const separator of [String.fromCharCode(10),String.fromCharCode(13,10)]){
    const text=yaml.split(String.fromCharCode(13)).join('').split(String.fromCharCode(10)).join(separator);
    assert.doesNotThrow(()=>runtimePathInitialization(text));
    assert.throws(()=>runtimePathInitialization(text.replace('    env:','    env:'+separator+'      BAD: '+ '$'+'{{ runner.temp }}')));
  }
});

const canonicalExport = line => {
  const equals=line.indexOf('=');
  assert.ok(equals>0,'export key missing');
  const value=line.slice(equals+1);
  assert.ok(isAbsolute(value),'export path must be absolute');
  // Leaves do not exist yet; resolve their existing parent through the filesystem.
  return line.slice(0,equals+1)+join(realpathSync.native(dirname(value)),basename(value));
};

test('export path comparison accepts filesystem aliases but rejects outside and sibling paths',()=>{
  const root=mkdtempSync(join(tmpdir(),'c2d2g paths '));
  try{
    const actual=join(root,'actual root');
    const alias=join(root,'alias root');
    const outside=join(root,'outside root');
    mkdirSync(actual);mkdirSync(outside);
    symlinkSync(actual,alias,'junction');
    const line=base=>'C2D2_UDF='+join(base,'c2d2-udf-123456-1');
    assert.equal(canonicalExport(line(alias)),canonicalExport(line(actual)));
    assert.notEqual(canonicalExport(line(outside)),canonicalExport(line(actual)));
    assert.notEqual(canonicalExport('C2D2_UDF='+join(alias,'wrong-udf')),canonicalExport(line(actual)));
    assert.throws(()=>canonicalExport('C2D2_UDF=relative-path'));
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('PowerShell initializer handles spaces and exports three paths for subsequent steps only',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/desktop-surface-c2d2-runtime.yml',import.meta.url),'utf8');
  const script=runtimePathInitialization(yaml);
  const root=mkdtempSync(join(tmpdir(),'c2d2c paths '));
  try{
    const envFile=join(root,'github env.txt');
    const environment={...process.env,RUNNER_TEMP:root,GITHUB_ENV:envFile,GITHUB_RUN_ID:'123456',GITHUB_RUN_ATTEMPT:'1'};
    for(const key of ['C2D2_DIAGNOSTICS','C2D2_PREFLIGHT_PATH','C2D2_UDF'])delete environment[key];
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      script+String.fromCharCode(10)+'if ($env:C2D2_DIAGNOSTICS) { exit 99 }'],{env:environment,encoding:'utf8'});
    assert.equal(result.status,0);
    assert.equal(result.stdout.trim(),'');
    const text=readFileSync(envFile,'utf8').split(String.fromCharCode(65279)).join('');
    const lines=text.split(String.fromCharCode(10)).map(line=>line.trim()).filter(Boolean);
    assert.deepEqual(lines.map(canonicalExport),[
      'C2D2_DIAGNOSTICS='+join(root,'c2d2-diagnostics'),
      'C2D2_PREFLIGHT_PATH='+join(root,'c2d2-preflight.json'),
      'C2D2_UDF='+join(root,'c2d2-udf-123456-1'),
    ].map(canonicalExport));
  }finally{rmSync(root,{recursive:true,force:true});}
});
