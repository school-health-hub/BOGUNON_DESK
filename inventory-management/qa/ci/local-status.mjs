/** Local-only status reader; stdout credentials are consumed privately by the PowerShell caller. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const fail=code=>{throw new Error(code);};
export function parseLocalStatus(status) {
  if(!status || typeof status!=='object' || status.API_URL!=='http://127.0.0.1:56321'
    || (status.PROJECT_ID!==undefined && status.PROJECT_ID!=='inventory_qa'))fail('LOCAL_QA_STATUS_ORIGIN');
  if(typeof status.ANON_KEY==='string' && status.ANON_KEY) {
    try {
      const parts=status.ANON_KEY.split('.');
      if(parts.length!==3 || parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))fail('LOCAL_QA_KEY_ROLE');
      const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
      if(payload.role!=='anon')fail('LOCAL_QA_KEY_ROLE');
      return {apiBase:status.API_URL,key:status.ANON_KEY,keyKind:'anon-jwt'};
    } catch {fail('LOCAL_QA_KEY_ROLE');}
  }
  if(typeof status.PUBLISHABLE_KEY==='string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(status.PUBLISHABLE_KEY)) {
    return {apiBase:status.API_URL,key:status.PUBLISHABLE_KEY,keyKind:'publishable'};
  }
  fail('LOCAL_QA_PUBLIC_KEY_MISSING');
}
export function readLocalStatus(qaRoot,command=(file,args)=>{
  const r=spawnSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000,shell:process.platform==='win32' && file==='npm.cmd'});
  if(r.error || r.status!==0)fail('LOCAL_QA_STATUS_COMMAND');
  return r.stdout;
}) {
  if(process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)fail('LOCAL_QA_DOCKER_CONTEXT');
  const config=readFileSync(resolve(qaRoot,'supabase/config.toml'),'utf8');
  if(!/^project_id\s*=\s*"inventory_qa"/m.test(config) || /https:\/\//.test(config))fail('LOCAL_QA_PROJECT');
  let db,status;
  try {
    db=JSON.parse(command('docker',['inspect','supabase_db_inventory_qa']))[0];
    if(db?.Name!=='/supabase_db_inventory_qa' || db.State?.Health?.Status!=='healthy')fail('LOCAL_QA_PROJECT');
    // JSON is the actual CLI 2.121.0 status format used by the existing adapter runner.
    const npm=process.platform==='win32'?'npm.cmd':'npm';
    status=JSON.parse(command(npm,['exec','--yes','--package=supabase@2.121.0','--','supabase','--workdir',qaRoot,'status','-o','json']));
  } catch {fail('LOCAL_QA_STATUS_UNAVAILABLE');}
  return parseLocalStatus(status);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {process.stdout.write(JSON.stringify(readLocalStatus(resolve(process.argv[2]))));}
  catch {console.error('Local Inventory QA status/key validation failed; no credentials logged.');process.exitCode=1;}
}
