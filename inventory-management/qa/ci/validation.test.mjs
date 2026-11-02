import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { minimumResources, parseSummaries, validateManifest } from './validation.mjs';
test('resource gate rejects the home PC baseline and missing metrics',()=>{
  assert.throws(()=>minimumResources(1.71*2**30,1.49*2**30));assert.throws(()=>minimumResources(NaN,8*2**30));minimumResources(20*2**30,4*2**30);
});
test('SQL counts require exact complete passes; cannot hide failures or skip',()=>{
  parseSummaries('TEST|synthetic|PASS\nSUMMARY|15|15|0\n',[15]);
  for(const s of ['SUMMARY|15|14|1','SUMMARY|14|14|0','', 'SUMMARY|15|15|0\nSUMMARY|15|15|0'])assert.throws(()=>parseSummaries(s,[15]));
});
test('INV-D06 historical PASS and pending contracts are checked independently',()=>{
  const m=JSON.parse(readFileSync(new URL('../contracts/qa-contracts.json',import.meta.url),'utf8'));validateManifest(m);
  m.contracts.find(c=>c.id==='INV-D06').status='PENDING_IMPLEMENTATION';assert.throws(()=>validateManifest(m));
});
test('PowerShell prep expected set matches the historical manifest without changing statuses',()=>{
  const prep=readFileSync(new URL('../scripts/Test-Prep.ps1',import.meta.url),'utf8');
  const ids=[...prep.split('$implementedContractIds = @(')[1].split(')')[0].matchAll(/"(INV-[A-Z]\d+)"/g)].map(m=>m[1]);
  const m=JSON.parse(readFileSync(new URL('../contracts/qa-contracts.json',import.meta.url),'utf8'));
  assert.deepEqual(ids.slice().sort(),m.contracts.filter(c=>c.status==='PASS').map(c=>c.id).sort());
});
test('orchestrator rejects non-Actions context without Docker or credential output',async()=>{
  const {spawnSync}=await import('node:child_process');
  const r=spawnSync(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,'preflight'],{encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'false'}});
  assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/FAIL: RUNNER_ENVIRONMENT/);
  assert(!/eyJ|password|access_token|sb_secret_/.test(r.stderr));
});
