import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
// Local, one-shot query Host only. No command-line target HWND, profile or external program input.
if(process.platform!=='win32'||process.argv.length!==2)throw Error('NATIVE05A_WINDOWS_ONLY');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceSha=git('rev-parse','HEAD');
if(git('branch','--show-current')!=='feature/electron-native-surface-live-preflight'||git('status','--porcelain'))
  throw Error('NATIVE05A_CLEAN_CHECKPOINT_REQUIRED');
execFileSync('git',['merge-base','--is-ancestor','0bdf404ee66d0673ca294a9baff45c6afe364a6c','HEAD']);
const base='E:\\BOGUNON_DEV\\qa\\native-05a';await mkdir(base,{recursive:true});
const root=await mkdtemp(join(base,'run-'));await mkdir(join(root,'temp'));
const target='E:\\BOGUNON_DEV\\qa\\native-05a-target';
execFileSync('cargo',['build','--offline','--locked','--manifest-path','tools/electron-native-workerw/Cargo.toml',
  '--features','windows-observation-skip-miri','--bin','native05a-readonly'],
  {env:{...process.env,CARGO_TARGET_DIR:target,BOGUNON_NATIVE_SOURCE_SHA:sourceSha},stdio:'inherit'});
if(git('rev-parse','HEAD')!==sourceSha||git('status','--porcelain'))throw Error('NATIVE05A_SOURCE_CHANGED_BEFORE_RUN');
const exe=join(target,'debug','native05a-readonly.exe');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const exeSha256=digest(await readFile(exe));
const systemRoot=process.env.SystemRoot??'C:\\Windows';
// No APPDATA/profile use, network, inherited tokens or registry dumps in this headless reader.
const child=spawnSync(exe,['--read-only-preflight'],{windowsHide:true,timeout:25000,maxBuffer:65536,encoding:'utf8',
  env:{SystemRoot:systemRoot,WINDIR:systemRoot,TEMP:join(root,'temp'),TMP:join(root,'temp')}});
let report=null;
try{report=JSON.parse(child.stdout??'');}catch{ /* Evidence remains failed, never retried. */ }
const o=report?.observation;
const allowed=['provenance','shellVerified','topologyStable','progmanObserved','workersEnumerated','eligibleWorkers',
  'referenceWindowStateObserved','referenceDpiCompatible','targetVerified','executionAllowed','nativeCleanup','blocker'];
const booleans=['shellVerified','topologyStable','progmanObserved','referenceWindowStateObserved','referenceDpiCompatible'];
const count=v=>v===null||(Number.isInteger(v)&&v>=0&&v<=512);
const schemaValid=report?.sourceSha===sourceSha&&report?.mode==='ReadOnly'&&o
  &&booleans.every(k=>typeof o[k]==='boolean')&&count(o.workersEnumerated)&&count(o.eligibleWorkers)
  &&['ObservationUnavailable','ShellIdentityOrTopologyUnverified','NoUniqueEligibleWorker','HostOwnedTargetMissing'].includes(o.blocker)
  &&Object.keys(report).length===3&&Object.keys(o).length===allowed.length&&Object.keys(o).every(k=>allowed.includes(k))
  &&o.provenance==='OsReadOnly'&&o.executionAllowed===false&&o.targetVerified===false&&o.nativeCleanup==='NotVerified';
if(!schemaValid)report=null;
const sourceStable=git('rev-parse','HEAD')===sourceSha&&!git('status','--porcelain');
const result={schema:1,sourceSha,sourceStable,exeSha256,mode:'ReadOnly',status:child.status,signal:child.signal,
  error:child.error?.code??null,passed:sourceStable&&child.status===0&&report?.sourceSha===sourceSha&&report?.mode==='ReadOnly'&&!!schemaValid,
  report,stdoutBytes:Buffer.byteLength(child.stdout??''),stderrBytes:Buffer.byteLength(child.stderr??''),
  stdoutSha256:digest(child.stdout??''),stderrSha256:digest(child.stderr??''),
  attachment:'NOT_RUN',liveCleanup:'NOT_VERIFIED',rawOutput:'NOT_PERSISTED'};
await writeFile(join(root,'VERIFICATION.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({passed:result.passed,sourceSha,evidence:root,observation:report?.observation??null}));
if(!result.passed)throw Error('NATIVE05A_READ_ONLY_FAILED_NO_RETRY');
