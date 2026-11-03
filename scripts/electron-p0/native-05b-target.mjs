import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
if(process.platform!=='win32'||process.argv.length!==2)throw Error('NATIVE05B_WINDOWS_ONLY');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceSha=git('rev-parse','HEAD');
const stable=()=>git('rev-parse','HEAD')===sourceSha&&!git('status','--porcelain');
if(git('branch','--show-current')!=='feature/electron-native-surface-live-target'||!stable())throw Error('NATIVE05B_CLEAN_SOURCE_REQUIRED');
execFileSync('git',['merge-base','--is-ancestor','350cdec3e3e9360609c29306bbd3c268e230f635','HEAD']);
const base='E:\\BOGUNON_DEV\\qa\\native-05b';await mkdir(base,{recursive:true});
const root=await mkdtemp(join(base,'run-'));await mkdir(join(root,'temp'));
const target='E:\\BOGUNON_DEV\\qa\\native-05b-target';
execFileSync('cargo',['build','--offline','--locked','--manifest-path','tools/electron-native-workerw/Cargo.toml',
  '--features','windows-test-target-skip-miri','--bin','native05b-target'],
  {env:{...process.env,CARGO_TARGET_DIR:target,BOGUNON_NATIVE_SOURCE_SHA:sourceSha},stdio:'inherit'});
const exe=join(target,'debug','native05b-target.exe');const hash=v=>createHash('sha256').update(v).digest('hex');
const exeSha256=hash(await readFile(exe));
const systemRoot=process.env.SystemRoot??'C:\\Windows';
const ps=join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
const env={SystemRoot:systemRoot,WINDIR:systemRoot,TEMP:join(root,'temp'),TMP:join(root,'temp')};
const query=code=>execFileSync(ps,['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',windowsHide:true,timeout:10000,env}).trim();
const count=name=>Number(query(`@(Get-CimInstance Win32_Process -Filter "Name = '${name}'").Count`));
if(count('native05b-target.exe')!==0)throw Error('NATIVE05B_EXISTING_HOST_PRESERVED');
const electronBefore=count('electron.exe');const results=[];
for(const caseId of ['normal','host-loss']){
  if(!stable())throw Error('NATIVE05B_SOURCE_CHANGED_BEFORE_RUN');
  if(hash(await readFile(exe))!==exeSha256)throw Error('NATIVE05B_EXECUTABLE_CHANGED_BEFORE_RUN');
  const child=spawnSync(exe,['--isolated-test-target',...(caseId==='host-loss'?['--host-loss']:[])],
    {env,encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:131072});
  let parsed=null;try{parsed=JSON.parse(child.stdout??'');}catch{ /* Never retry a failed case. */ }
  const report=parsed?.report,baseline=report?.localBaseline;
  const valid=parsed?.sourceSha===sourceSha&&report?.caseId===caseId&&report?.attachment==='NOT_RUN'
    &&report?.executionAllowed===false&&report?.nativeCleanup==='NotVerified'
    &&baseline&&/^[1-9][0-9]{0,18}$/.test(baseline.hwnd)&&BigInt(baseline.hwnd)<=9223372036854775807n
    &&Number.isInteger(baseline.pid)&&baseline.pid>0&&baseline.pid<=4294967295
    &&typeof report.windowQaPassed==='boolean'&&Array.isArray(report.candidate?.rows)&&report.candidate.rows.length<=512;
  let oldWindowGone=false,baselineSha256=null;
  if(valid){
    // Raw OS IDs/baseline stay local only. No window titles, paths, credentials or profiles are captured.
    const bytes=Buffer.from(JSON.stringify({sourceSha,caseId,baseline},null,2));baselineSha256=hash(bytes);
    await writeFile(join(root,`${caseId}-LOCAL-BASELINE.json`),bytes,{flag:'wx'});
    const code=`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class Native05BQuery{[DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}'; $h=[IntPtr][long]'${baseline.hwnd}'; [uint32]$owner=0; $exists=[Native05BQuery]::IsWindow($h); if($exists){[void][Native05BQuery]::GetWindowThreadProcessId($h,[ref]$owner)}; [int]($exists -and $owner -eq ${baseline.pid})`;
    oldWindowGone=query(code)==='0';
  }
  const hostResidual=count('native05b-target.exe'),electronAfter=count('electron.exe'),sourceStable=stable();
  const executableStable=hash(await readFile(exe))===exeSha256;
  const caseContract=valid&&report.duplicateRejected===true&&report.wrongWindowRejected===true
    &&(caseId==='normal'?report.windowDestroyed===true&&report.disappearanceRejected===true&&report.windowLeaseReleased===true
      :report.preflightBlocker==='CleanupUnknown'&&report.windowDestroyed===false&&report.windowLeaseReleased===false);
  const passed=!!valid&&caseContract&&executableStable&&sourceStable&&child.status===(caseId==='normal'?0:42)&&report.windowQaPassed
    &&hostResidual===0&&oldWindowGone&&electronAfter===electronBefore;
  const summary=valid?{...report,localBaseline:undefined}:null;
  const result={caseId,passed,status:child.status,error:child.error?.code??null,sourceStable,executableStable,hostResidual,oldWindowGone,
    electronBefore,electronAfter,baselineSha256,summary,stdoutBytes:Buffer.byteLength(child.stdout??''),
    stderrBytes:Buffer.byteLength(child.stderr??''),stdoutSha256:hash(child.stdout??''),stderrSha256:hash(child.stderr??'')};
  results.push(result);
  await writeFile(join(root,'VERIFICATION.json'),JSON.stringify({sourceSha,exeSha256,results,attachment:'NOT_RUN',
    liveCleanup:'NOT_VERIFIED',rawOutput:'NOT_PERSISTED',rawBaseline:'LOCAL_ONLY'},null,2));
  console.log(JSON.stringify({caseId,passed,candidate:summary?.candidate?.status??null,hostResidual,oldWindowGone}));
  if(!passed)throw Error('NATIVE05B_CASE_FAILED_NO_RETRY');
}
console.log(JSON.stringify({sourceSha,evidence:root,cases:results.length}));
