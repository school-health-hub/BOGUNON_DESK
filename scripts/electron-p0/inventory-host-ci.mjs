import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateHostCi,validateLocalConfig,validateRealReport,DB_BASELINE,HOST_BASELINE,EXPECTED_CASES} from './inventory-host-ci-policy.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),step=process.argv[2];
let summary,report,active='CONTEXT',safe=false;
const run=(file,args,{input,timeout=180000,env=process.env}={})=>{const r=spawnSync(file,args,{cwd:root,input,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout,maxBuffer:8*1024*1024});if(r.error||r.status!==0)throw Error('COMMAND_FAILED');return r.stdout;};
const save=()=>{mkdirSync(dirname(report),{recursive:true});writeFileSync(report,JSON.stringify(summary,null,2)+'\n',{mode:0o600});};
try{
 validateHostCi(process.env,process.platform,root);safe=true;
 if(!['preflight','contracts','build','root-types','start','migration','e2e','stop'].includes(step))throw Error('UNKNOWN_STAGE');
 report=resolve(process.env.RUNNER_TEMP,'electron-int-el02-qa/summary.json');
 summary=existsSync(report)?JSON.parse(readFileSync(report,'utf8')):{version:1,sourceSha:process.env.GITHUB_SHA,dbBaseline:DB_BASELINE,hostBaseline:HOST_BASELINE,runId:process.env.GITHUB_RUN_ID,steps:{},realDbE2E:'NOT_RUN',actualElectronProcess:'NOT_RUN',windowsGui:'NOT_RUN',windowsNodeContracts:'separate Actions job; not inferred from Linux'};
 if(summary.sourceSha!==process.env.GITHUB_SHA||summary.runId!==process.env.GITHUB_RUN_ID)throw Error('SUMMARY_IDENTITY');
 const baseline=resolve(root,'.inventory-db-baseline'),qa=resolve(baseline,'inventory-management/qa');
 if(step!=='stop'){
  if(run('git',['-C',baseline,'rev-parse','HEAD']).trim()!==DB_BASELINE)throw Error('BASELINE_SHA');
 validateLocalConfig(readFileSync(resolve(qa,'supabase/config.toml'),'utf8'));
 run('git',['diff','--exit-code',HOST_BASELINE,'HEAD','--','electron-p0','src','src-tauri','package.json','package-lock.json','tsconfig.json','tsconfig.node.json']);
 run('git',['-C',baseline,'diff','--exit-code','--','inventory-management/qa/supabase']);
 }
 const cli=(args,timeout=180000)=>run('npm',['exec','--yes','--package=supabase@2.121.0','--','supabase','--workdir',qa,...args],{timeout});
 const sql=input=>run('docker',['exec','-i','supabase_db_inventory_qa','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input});
 const requireStep=name=>{if(summary.steps[name]!=='PASS')throw Error('REQUIRED_STAGE');};
 active=step;
 if(step==='preflight'){
  if(run('git',['rev-parse','HEAD']).trim()!==process.env.GITHUB_SHA)throw Error('SOURCE_SHA');
  run('git',['merge-base','--is-ancestor',HOST_BASELINE,'HEAD']);
  if(run('docker',['context','show']).trim()!=='default'||run('docker',['context','inspect','default','--format','{{.Endpoints.docker.Host}}']).trim()!=='unix:///var/run/docker.sock')throw Error('DOCKER_CONTEXT');
  if(!process.version.startsWith('v24.'))throw Error('NODE_VERSION');
  if(run('docker',['ps','-a','--filter','name=_inventory_qa$','--format','{{.Names}}']).trim())throw Error('EXISTING_STACK');
  const validation=await import(pathToFileURL(resolve(qa,'ci/validation.mjs')).href);
  const dockerRoot=run('docker',['info','--format','{{.DockerRootDir}}']).trim();
  const disk=Number(run('df',['-B1','--output=avail',dockerRoot]).trim().split(/\s+/).pop()),memory=Number(readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)?.[1])*1024;validation.minimumResources(disk,memory);
  if(run('npm',['view','supabase@2.121.0','dist.integrity']).trim()!=='sha512-xffhOgD9rXsXLK+DQ+3Gq8b2KmavMjPHGuJr7lfVlD8vKK1HHFggYlmzdRECqPmOL8g3Yd5PN3URcUR8xWZcWw==')throw Error('CLI_INTEGRITY');
  for(const args of [['start','--help'],['db','reset','--help'],['stop','--help']])cli(args);
 }
 if(step==='contracts'){
  requireStep('preflight');run(process.execPath,['--test','scripts/electron-p0/inventory-host-ci-policy.test.mjs','scripts/electron-p0/int-el02-root-types.test.mjs']);
  const output=run(process.execPath,['node_modules/vitest/vitest.mjs','run','--maxWorkers=2','src/newsletter','electron-p0/tests/newsletter','electron-p0/tests/inventory','electron-p0/tests/policy.test.ts','electron-p0/tests/sample-ipc.test.ts','electron-p0/tests/memo-ipc.test.ts']).replace(/\x1b\[[0-9;]*m/g,'');
  if(!/Tests\s+345 passed/.test(output)||/\d+ skipped/.test(output))throw Error('CONTRACT_COUNTS');summary.newsletterInventoryAndIpc={status:'PASS',tests:345,actualElectronProcess:false};
 }
 if(step==='build'){
  requireStep('contracts');run('npm',['run','electron:p0:build']);summary.electronTypeScriptAndProductionBuild='PASS';
 }
 if(step==='root-types'){
  requireStep('build');const debt=JSON.parse(run(process.execPath,['scripts/electron-p0/int-el02-root-types.mjs']));if(debt.status!=='EXPECTED_FAILURE'||debt.rootTypecheck!=='FAIL'||debt.newDiagnostics!==0||debt.actualCount!==15)throw Error('ROOT_DEBT_CHANGED');summary.rootTypeDebt=debt;
 }
 if(step==='start'){
  requireStep('root-types');summary.startAttempted=true;save();
  cli(['start','--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor','--yes'],900000);
  const {readLocalStatus}=await import(pathToFileURL(resolve(qa,'ci/local-status.mjs')).href);readLocalStatus(qa);
 }
 if(step==='migration'){
  requireStep('start');cli(['db','reset','--local','--no-seed','--yes'],240000);
  const versions=sql('select version from supabase_migrations.schema_migrations order by version;').trim().split(/\r?\n/);
  if(JSON.stringify(versions)!==JSON.stringify(['20261023024023','20261023033015','20261023040118','20261023045956','20261023054853','20261102005531']))throw Error('MIGRATION_ORDER');
  sql(readFileSync(resolve(qa,'tests/IM-2B-1-security-catalog.sql'),'utf8'));summary.migrations={unchanged:true,count:6};
 }
 if(step==='e2e'){
  requireStep('migration');summary.realDbE2E='RUNNING';save();
  const execution=spawnSync(process.execPath,['scripts/electron-p0/inventory-host-db-e2e.mjs'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:240000,maxBuffer:2*1024*1024});
  const result=JSON.parse(execution.stdout.trim());
  if(execution.error||execution.status!==0){summary.failedCase=EXPECTED_CASES.includes(result.failedCase)?result.failedCase:'CONTEXT';throw Error('REAL_E2E_FAILED');}
  validateRealReport(result);
  const violations=sql("select (select count(*) from public.inventory_stock_lots where remaining_quantity<0)+(select count(*) from public.inventory_stock_movements where quantity_before+quantity_delta<>quantity_after)+(select count(*) from public.inventory_idempotency_requests where status<>'COMPLETED');").trim();if(violations!=='0')throw Error('FINAL_INVARIANTS');
  summary.realDbE2E='PASS';summary.realCases=result.passedCases;summary.authExpiryScope='real login + controlled client-memory clock; server JWT wall-clock expiry NOT RUN';summary.negativeScope='real job-owned Kong pause/stop; no mock transport';
 }
 if(step==='stop'&&summary.startAttempted){
  const inspected=spawnSync('docker',['inspect','supabase_kong_inventory_qa'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
  if(inspected.status===0){const gateway=JSON.parse(inspected.stdout)[0];if(gateway.Name!=='/supabase_kong_inventory_qa')throw Error('GATEWAY_IDENTITY');if(gateway.State?.Paused)run('docker',['unpause','supabase_kong_inventory_qa']);}
  cli(['stop','--project-id','inventory_qa']);summary.cleanup='PASS';
 }
 summary.steps[step]='PASS';save();console.log(`PASS: ${step}; sanitized evidence only.`);
}catch{
 if(safe&&summary&&report){if(summary.realDbE2E==='RUNNING')summary.realDbE2E='FAIL';summary.steps[step]='FAIL';summary.failedCheck=active;save();}
 console.error('BLOCKED: isolated Inventory Host CI stage failed. Raw stdout/stderr, SQL, credentials and HTTP bodies withheld.');process.exitCode=1;
}
