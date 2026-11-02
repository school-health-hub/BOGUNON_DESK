import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocalStatus, parseLocalStatus } from './local-status.mjs';
import { randomBytes } from 'node:crypto';
import { mkdtempSync,writeFileSync,mkdirSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const jwt=role=>[Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url'),Buffer.from(JSON.stringify({role})).toString('base64url'),randomBytes(24).toString('base64url')].join('.');
const base={API_URL:'http://127.0.0.1:56321'};
test('CLI 2.121.0 API_URL/ANON_KEY JSON accepts only anonymous role',()=>{
  const key=jwt('anon');assert.deepEqual(parseLocalStatus({...base,ANON_KEY:key}),{apiBase:base.API_URL,key,keyKind:'anon-jwt'});
  assert.throws(()=>parseLocalStatus({...base,ANON_KEY:jwt('service_role')}),/LOCAL_QA_KEY_ROLE/);
});
test('publishable is distinguished from bearer JWT; secret and missing keys rejected',()=>{
  assert.equal(parseLocalStatus({...base,PUBLISHABLE_KEY:'sb_publishable_synthetic'}).keyKind,'publishable');
  for(const s of [base,{...base,SERVICE_ROLE_KEY:jwt('service_role')},{...base,PUBLISHABLE_KEY:'sb_secret_synthetic'}])assert.throws(()=>parseLocalStatus(s),/LOCAL_QA_PUBLIC_KEY_MISSING/);
});
test('wrong endpoint, project, path and port fail without including status or key',()=>{
  const key=jwt('anon');for(const bad of [{...base,API_URL:'https://example.invalid'},{...base,API_URL:'http://127.0.0.1:54321'},{...base,API_URL:base.API_URL+'/path'},{...base,PROJECT_ID:'other'}]) {
    assert.throws(()=>parseLocalStatus({...bad,ANON_KEY:key}),e=>e.message==='LOCAL_QA_STATUS_ORIGIN' && !e.message.includes(key));
  }
});
test('uses running inventory DB and pinned CLI JSON status, never Studio',()=>{
  const dir=mkdtempSync(join(tmpdir(),'inventory-status-test-'));
  try {
    mkdirSync(join(dir,'supabase'));writeFileSync(join(dir,'supabase/config.toml'),'project_id = "inventory_qa"\n');
    const calls=[];const key=jwt('anon');
    const result=readLocalStatus(dir,(file,args)=>{calls.push([file,args]);return file==='docker'?JSON.stringify([{Name:'/supabase_db_inventory_qa',State:{Health:{Status:'healthy'}}}]):JSON.stringify({...base,ANON_KEY:key,SERVICE_ROLE_KEY:jwt('service_role')});});
    assert.equal(result.key,key);assert.equal(calls.length,2);assert(!JSON.stringify(calls).includes('studio'));assert(calls[1][1].includes('--package=supabase@2.121.0'));assert(calls[1][1].includes('json'));
    assert.throws(()=>readLocalStatus(dir,()=>{throw Error(key);}),e=>e.message==='LOCAL_QA_STATUS_UNAVAILABLE' && !e.message.includes(key));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
