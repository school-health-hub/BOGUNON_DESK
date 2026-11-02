import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateHostCi,validateLocalConfig,validateRealReport,HOST_CI_REF,EXPECTED_CASES} from './inventory-host-ci-policy.mjs';
const env={GITHUB_ACTIONS:'true',INVENTORY_HOST_CI_ONLY:'1',GITHUB_REPOSITORY:'school-health-hub/BOGUNON_DESK',GITHUB_REF:HOST_CI_REF,GITHUB_EVENT_NAME:'push',RUNNER_TEMP:tmpdir()};
test('CI guard permits only the explicitly isolated Linux push job (pure policy test)',()=>{
 const root=mkdtempSync(join(tmpdir(),'inv-el04-policy-'));try{
  assert.doesNotThrow(()=>validateHostCi(env,'linux',root));
  for(const patch of [{GITHUB_ACTIONS:'false'},{GITHUB_REF:'refs/heads/main'},{GITHUB_REF:'refs/heads/ci/inventory-electron-host-qa'},{GITHUB_REF:'refs/heads/ci/inventory-postgres-integration-qa'},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_EVENT_NAME:'workflow_dispatch'},{INVENTORY_HOST_CI_ONLY:'0'},{DOCKER_HOST:'tcp://example.invalid'},{DOCKER_CONTEXT:'other'},{SUPABASE_URL:'https://example.invalid'},{VITE_SUPABASE_URL:'https://example.invalid'}])assert.throws(()=>validateHostCi({...env,...patch},'linux',root));
  assert.throws(()=>validateHostCi(env,'win32',root));writeFileSync(join(root,'.env.local'),'synthetic placeholder');assert.throws(()=>validateHostCi(env,'linux',root));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('only pinned local project and port are accepted without an external origin',()=>{
 const text='project_id = "inventory_qa"\n[api]\nport = 56321\n';assert.doesNotThrow(()=>validateLocalConfig(text));
 for(const invalid of [text.replace('inventory_qa','operational'),text.replace('56321','54321'),text+'url="https://example.invalid"'])assert.throws(()=>validateLocalConfig(invalid));
});
test('mock, skipped, incomplete and actual Electron claims cannot satisfy the real DB evidence gate',()=>{
 const result={status:'PASS',realDatabase:true,mockTransport:false,actualElectronProcess:false,passedCases:EXPECTED_CASES};assert.doesNotThrow(()=>validateRealReport(result));
 for(const patch of [{status:'NOT_RUN'},{status:'FAIL'},{realDatabase:false},{mockTransport:true},{actualElectronProcess:true},{passedCases:EXPECTED_CASES.slice(0,-1)},{passedCases:[...EXPECTED_CASES].reverse()}])assert.throws(()=>validateRealReport({...result,...patch}));
});
