// Opt-in, already-running inventory_qa only. Never starts/resets a stack or contacts a remote project.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
function fail(){throw Error('Inventory local QA preflight failed; no external DB fallback.');}
try {
if(process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)fail();
const config=readFileSync(resolve(root,'inventory-management/qa/supabase/config.toml'),'utf8');
if(!/project_id\s*=\s*"inventory_qa"/.test(config) || !/port\s*=\s*56321/.test(config) || /https:\/\//.test(config))fail();
const inspect=JSON.parse(execFileSync('docker',['inspect','supabase_db_inventory_qa'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
if(inspect.Name!=='/supabase_db_inventory_qa' || inspect.State?.Health?.Status!=='healthy')fail();
const npm=process.platform==='win32'?'npm.cmd':'npm';
const status=JSON.parse(execFileSync(npm,['exec','--yes','--package=supabase@2.121.0','--','supabase','--workdir','inventory-management/qa','status','-o','json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:process.platform==='win32'}));
if(status.API_URL!=='http://127.0.0.1:56321' || !status.ANON_KEY)fail();
const result=spawnSync(process.execPath,[resolve(root,'node_modules/vitest/vitest.mjs'),'run','src/inventory-management/connection/connection.local.test.ts','--maxWorkers=1'],{cwd:root,stdio:'inherit',env:{...process.env,INVENTORY_IM2B1_REAL_LOCAL:'1',INVENTORY_QA_PUBLIC_KEY:status.ANON_KEY}});
process.exitCode=result.status??1;

} catch { console.error('NOT RUN: isolated inventory_qa preflight or CLI status failed. No credential output retained.'); process.exitCode=1; }
