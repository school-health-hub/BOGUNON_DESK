/** CI-only local inventory_qa orchestrator. Never print command output or credentials. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSummaries, minimumResources, validateManifest } from './validation.mjs';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
// ci/ -> qa/ -> inventory-management/ -> repository
const qa=resolve(root,'inventory-management/qa');
const report=resolve(qa,'reports/inv-ci-01/summary.json');
const step=process.argv[2];
let activeCheck='context';
const stages=['preflight','start','migration','regression','jwt','adapter','security','stop'];
const categories={preflight:'RUNNER_ENVIRONMENT',start:'DOCKER_IMAGE_OR_START',migration:'MIGRATION',regression:'SQL_OR_CONTRACT',jwt:'JWT_RLS_OR_CONCURRENCY',adapter:'ADAPTER_INTEGRATION',security:'PERMISSION_OR_INTEGRITY',stop:'CLEANUP_ENVIRONMENT'};
let summary={schemaVersion:1,platform:'ubuntu-24.04 Linux (not Windows Native)',sha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,steps:{}};
function requireSafeContext() {
  if(process.platform!=='linux' || process.env.GITHUB_ACTIONS!=='true' || process.env.INVENTORY_CI_ONLY!=='1'
    || process.env.GITHUB_REPOSITORY!=='school-health-hub/BOGUNON_DESK' || process.env.GITHUB_REF!=='refs/heads/ci/inventory-postgres-integration-qa'
    || process.env.GITHUB_EVENT_NAME!=='push' || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)throw Error('CI_CONTEXT');
  if(!stages.includes(step))throw Error('UNKNOWN_STAGE');
  const config=readFileSync(resolve(qa,'supabase/config.toml'),'utf8');
  if(!/^project_id\s*=\s*"inventory_qa"/m.test(config) || !/port\s*=\s*56321/.test(config) || /https:\/\//.test(config))throw Error('LOCAL_CONFIG');
  // Do not read values or include environment dumps in any evidence.
  const forbidden=Object.keys(process.env).filter(k=>/^(VITE_SUPABASE_|SUPABASE_(URL|ACCESS_TOKEN|DB_PASSWORD|SERVICE_ROLE|SECRET|PROJECT_REF))/.test(k));
  if(forbidden.length || ['.env','.env.local','.env.production'].some(f=>existsSync(resolve(root,f))))throw Error('EXTERNAL_ENV');
}
function run(file,args,{input,timeout=180000}={}) {
  const r=spawnSync(file,args,{cwd:root,input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout,maxBuffer:8*1024*1024});
  if(r.error || r.status!==0)throw Error('COMMAND_FAILED');
  return r.stdout; // Remains in memory. Never echo, save or upload raw stdout/stderr.
}
const cli=(args,timeout=180000)=>{activeCheck=`supabase-${args[0]}`;return run('npm',['exec','--yes','--package=supabase@2.121.0','--','supabase','--workdir',qa,...args],{timeout});};
const sql=(input)=>run('docker',['exec','-i','supabase_db_inventory_qa','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input});
const ps=(name)=>{activeCheck=name;return run('pwsh',['-NoLogo','-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'; & '${resolve(qa,'scripts',name)}' | Out-Null`],{timeout:240000});};
const sqlFile=(name)=>{activeCheck=name;return sql(readFileSync(resolve(qa,'tests',name),'utf8'));};
const save=()=>{mkdirSync(resolve(qa,'reports/inv-ci-01'),{recursive:true});writeFileSync(report,JSON.stringify(summary,null,2)+'\n',{mode:0o600});};
try {
  requireSafeContext();
  if(existsSync(report))summary=JSON.parse(readFileSync(report,'utf8'));
  if(step==='preflight') {
    if(!process.version.startsWith('v24.'))throw Error('NODE_VERSION');
    run('pwsh',['-NoProfile','-Command','$PSVersionTable.PSVersion.ToString()']);
    run('pwsh',['-NoProfile','-NonInteractive','-Command',`$errors=@(); Get-ChildItem '${qa}/scripts/*.ps1' | ForEach-Object { $tokens=$null; $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($_.FullName,[ref]$tokens,[ref]$e); $errors+=@($e) }; if($errors.Count -ne 0){exit 1}`]);
    const dockerRoot=run('docker',['info','--format','{{.DockerRootDir}}']).trim();
    const disk=Number(run('df',['-B1','--output=avail',dockerRoot]).trim().split(/\s+/).pop());
    const memory=Number(readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)?.[1])*1024;
    minimumResources(disk,memory);
    if(run('docker',['ps','-a','--filter','name=^/supabase_db_inventory_qa$','--format','{{.Names}}']).trim())throw Error('EXISTING_QA');
    const integrity=run('npm',['view','supabase@2.121.0','dist.integrity']).trim();
    if(integrity!=='sha512-xffhOgD9rXsXLK+DQ+3Gq8b2KmavMjPHGuJr7lfVlD8vKK1HHFggYlmzdRECqPmOL8g3Yd5PN3URcUR8xWZcWw==')throw Error('CLI_INTEGRITY');
    for(const args of [['start','--help'],['db','reset','--help'],['db','lint','--help'],['stop','--help']])cli(args);
    summary.resources={diskAvailableGiB:Math.floor(disk/2**30),memoryAvailableGiB:Math.floor(memory/2**30)};
    run(process.execPath,['--test','inventory-management/qa/ci/local-status.test.mjs']);
    validateManifest(JSON.parse(readFileSync(resolve(qa,'contracts/qa-contracts.json'),'utf8')));
  }
  if(step==='start') {
    if(summary.steps.preflight?.status!=='PASS')throw Error('PREFLIGHT_REQUIRED');
    summary.startAttempted=true;save();
    cli(['start','--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor','--yes'],900000);
    const status=JSON.parse(cli(['status','-o','json']));
    if(status.API_URL!=='http://127.0.0.1:56321')throw Error('API_ORIGIN');
    summary.statusFormat={cli:'2.121.0',format:'json',apiField:'API_URL',hasAnonKey:typeof status.ANON_KEY==='string' && status.ANON_KEY.length>0,hasPublishableKey:typeof status.PUBLISHABLE_KEY==='string' && status.PUBLISHABLE_KEY.length>0};
    summary.stack='inventory_qa: PostgreSQL/Auth/REST/Kong';
  }
  if(step==='migration') {
    cli(['db','reset','--local','--no-seed','--yes'],240000);
    const expected=['20261023024023','20261023033015','20261023040118','20261023045956','20261023054853','20261102005531'];
    const actual=sql('select version from supabase_migrations.schema_migrations order by version;').trim().split(/\r?\n/);
    if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('MIGRATION_ORDER');
    sqlFile('IM-2B-1-security-catalog.sql');
    const rpcCount=sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('inventory_use_stock','inventory_receive_stock','inventory_dispose_stock','inventory_adjust_stock','inventory_reverse_movement','inventory_create_purchase_batch','inventory_set_purchase_batch_status','inventory_confirm_receipt');").trim();
    if(rpcCount!=='8')throw Error('RPC_BASELINE');
    summary.migration={applied:6,orderVerified:true,rpcs:8};
  }
  if(step==='regression') {
    ps('Test-Prep.ps1');
    const totals=[];
    for(const [script,path,count] of [['Invoke-IM1B1Tests.ps1','IM-1B-1-latest.json',17],['Invoke-IM1B2Tests.ps1','IM-1B-2-latest.json',17],['Invoke-IM1B3Tests.ps1','IM-1B-3-latest.json',24]]) {
      ps(script);const r=JSON.parse(readFileSync(resolve(qa,'reports',path),'utf8'));if(r.total!==count || r.passed!==count || r.failed!==0)throw Error('SQL_COUNTS');totals.push(count);
    }
    parseSummaries(sqlFile('IM-1B-4-admin-rpcs.sql'),[20]);totals.push(20);
    parseSummaries(sqlFile('IM-1B-5-purchase-receipts.sql'),[15]);
    parseSummaries(sqlFile('INV-CI-01-D06.sql'),[1]);
    summary.regression={existing:totals.reduce((a,b)=>a+b,0),purchase:15,invD06:'exact 10 ordered / ratio 1 / receipt 4 / stock +4 PASS'};
  }
  if(step==='jwt') {
    for(const name of ['Invoke-IM1B3HttpE2E.ps1','Invoke-IM1B4AHttpE2E.ps1','Invoke-IM1B4AConcurrency.ps1','Invoke-IM1B5HttpE2E.ps1','Invoke-IM1B5Concurrency.ps1'])ps(name);
    summary.jwt={realAuth:true,teacherInstructorInactiveAndCrossTenant:true,directDmlDenied:true,stockAndReceiptConcurrency:true};
  }
  if(step==='adapter') {
    activeCheck='real-adapter-four-tests';
    const actual=run(process.execPath,['inventory-management/qa/scripts/Run-IM2B1-local.mjs'],{timeout:240000}).replace(/\x1b\[[0-9;]*m/g,'');
    if(!/Tests\s+4 passed/.test(actual) || /\d+ skipped/.test(actual))throw Error('ADAPTER_NOT_FOUR_PASSES');
    run(process.execPath,['node_modules/vitest/vitest.mjs','run','src/inventory-management/connection/connection.test.ts','src/inventory-management/purchaseHelperAdapter.test.ts','--maxWorkers=2']);
    run(process.execPath,['inventory-management/qa/scripts/Verify-IM2B1-production.mjs']);
    run(process.execPath,['node_modules/typescript/bin/tsc','--noEmit']);
    summary.adapter={realIntegration:4,mockNotSubstituted:true,previewAndProductionIsolation:true,typecheck:true};
  }
  if(step==='security') {
    cli(['db','lint','--local','--schema','public,inventory_private','--level','error','--fail-on','error']);
    sqlFile('IM-2B-1-security-catalog.sql');
    const failures=sql(`select (select count(*) from public.inventory_stock_lots where remaining_quantity<0)
      +(select count(*) from public.inventory_stock_movements where quantity_before+quantity_delta<>quantity_after)
      +(select count(*) from public.inventory_idempotency_requests where status<>'COMPLETED')
      +(select count(*) from public.inventory_purchase_lines where received_base_quantity>requested_base_quantity);`).trim();
    if(failures!=='0')throw Error('INTEGRITY');
    summary.security={dbLint:true,rlsForceRlsAclAndSearchPath:true,finalInvariants:true};
  }
  if(step==='stop' && summary.startAttempted===true)cli(['stop','--project-id','inventory_qa'],180000);
  summary.steps[step]={status:'PASS'};save();console.log(`PASS: ${step}`);
} catch(error) {
  // No command stderr, SQL payload, Auth response, JWT or password in summaries/errors.
  if(stages.includes(step) && process.env.GITHUB_ACTIONS==='true' && process.env.GITHUB_REPOSITORY==='school-health-hub/BOGUNON_DESK') {
    summary.steps[step]={status:'FAIL',category:categories[step],check:activeCheck,reason:['CI_CONTEXT','UNKNOWN_STAGE','LOCAL_CONFIG','EXTERNAL_ENV','NODE_VERSION','EXISTING_QA','CLI_INTEGRITY','API_ORIGIN','MIGRATION_ORDER','RPC_BASELINE','SQL_COUNTS','ADAPTER_NOT_FOUR_PASSES','INTEGRITY','PREFLIGHT_REQUIRED'].includes(error?.message)?error.message:'COMMAND_OR_ASSERTION_FAILED'};save();
  }
  console.error(`FAIL: ${stages.includes(step)?categories[step]:'CI_CONTEXT'}; raw output withheld.`);process.exitCode=1;
}
