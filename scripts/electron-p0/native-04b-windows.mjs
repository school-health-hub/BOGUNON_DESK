import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {cp,mkdir,mkdtemp,readFile,realpath,symlink,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

// Local isolated QA only. No CLI-supplied executable, profile, source SHA or native command.
if(process.platform!=='win32'||process.argv.length!==2)throw Error('NATIVE04B_WINDOWS_ONLY');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceSha=git('rev-parse','HEAD');
if(git('branch','--show-current')!=='feature/electron-native-surface-host-workerw'
  ||git('status','--porcelain'))throw Error('NATIVE04B_CLEAN_CHECKPOINT_REQUIRED');
execFileSync('git',['merge-base','--is-ancestor','685c773fcc3916894eb14b989100bd77486016de','HEAD']);
const qaBase='E:\\BOGUNON_DEV\\qa\\native-04b';await mkdir(qaBase,{recursive:true});
const runRoot=await mkdtemp(join(qaBase,'run-'));
const hostSource='E:\\BOGUNON_DEV\\qa\\native-04b-target\\debug\\native04b-host.exe';
const hostSha256='d7fb3a81258c2d434b168c4c02ccc1d85bade375e9e52c7dcaab11e5b19e6732';
const hash=data=>createHash('sha256').update(data).digest('hex');
if(hash(await readFile(hostSource))!==hostSha256)throw Error('NATIVE04B_REVIEWED_HOST_DIGEST_REQUIRED');
const dependencies=await realpath(resolve('node_modules'));
// Portable official runtime only; do not repair or install into shared node_modules.
const runtimeRoot='E:\\BOGUNON_DEV\\qa\\native-03-runtime-45.2.1';
const electron=join(runtimeRoot,'dist','electron.exe');
const digestFile=async path=>{const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex');};
if(await digestFile(join(runtimeRoot,'electron-v45.2.1-win32-x64.zip'))!==
  '7c342aee45d5b4ccafe5dfe9037028796b082735a576e21e2b4e2d8422ebb727')throw Error('NATIVE04B_ELECTRON_ZIP_REJECTED');
const electronSha256=hash(await readFile(electron));
if(electronSha256!=='32e357fc856feadd1e51531f47811d2621483e5a58815eb4999154d7c9baea3b')throw Error('NATIVE04B_ELECTRON_IMAGE_REJECTED');
const template=join(runRoot,'template');
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','electron-p0/tsconfig.json',
  '--outDir',template,'--noEmitOnError'],{stdio:'inherit'});
await cp('electron-p0/package.json',join(template,'package.json'));
const systemRoot=process.env.SystemRoot??'C:\\Windows';
const ps=command=>execFileSync(join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),
  ['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:6000}).trim();
const residual=()=>Number(ps("@(Get-CimInstance Win32_Process -Filter \"Name = 'bogunon-surface-channel-host.exe'\").Count"));
if(residual()!==0)throw Error('NATIVE04B_EXISTING_HOST_PRESERVED');
const results=[];
for(const caseId of ['normal','cancel','host-lost','foreign-window']){
  const appRoot=join(runRoot,caseId);await mkdir(appRoot);await cp(template,appRoot,{recursive:true});
  await symlink(dependencies,join(appRoot,'node_modules'),'junction');
  await mkdir(join(appRoot,'native-surface'));
  await cp(hostSource,join(appRoot,'native-surface','bogunon-surface-channel-host.exe'));
  await writeFile(join(appRoot,'build-meta.json'),JSON.stringify({sourceSha}));
  await writeFile(join(appRoot,'native-surface-qa.json'),JSON.stringify({sourceSha,hostSha256,caseId}));
  for(const dir of ['temp','redirected-appdata','redirected-localappdata'])await mkdir(join(appRoot,dir));
  const env={SystemRoot:systemRoot,WINDIR:systemRoot,TEMP:join(appRoot,'temp'),TMP:join(appRoot,'temp'),
    APPDATA:join(appRoot,'redirected-appdata'),LOCALAPPDATA:join(appRoot,'redirected-localappdata')};
  const child=spawnSync(electron,[appRoot,'--native-workerw-dry-run-qa'],
    {env,windowsHide:true,encoding:'utf8',timeout:150000,maxBuffer:1024*1024});
  let diagnostic;
  try{diagnostic=JSON.parse(await readFile(join(appRoot,'native-surface-qa','RESULT.json'),'utf8'));}
  catch{diagnostic={passed:false,error:'RESULT_MISSING'};}
  const hostResidual=residual();
  const passed=child.status===0&&diagnostic.passed===true&&diagnostic.sourceSha===sourceSha&&hostResidual===0;
  const result={caseId,passed,status:child.status,signal:child.signal,error:child.error?.code??null,hostResidual,
    stdoutBytes:Buffer.byteLength(child.stdout??''),stderrBytes:Buffer.byteLength(child.stderr??''),
    stdoutSha256:hash(child.stdout??''),stderrSha256:hash(child.stderr??''),diagnostic};
  results.push(result);
  await writeFile(join(runRoot,'VERIFICATION.json'),JSON.stringify({sourceSha,hostSha256,electronSha256,results,
    nativeAttachment:'NOT_RUN',nativeCleanup:'NOT_VERIFIED',rawOutput:'NOT_PERSISTED'},null,2));
  console.log(JSON.stringify({caseId,passed,hostResidual,error:diagnostic.error}));
  if(!passed)throw Error('NATIVE04B_CASE_FAILED_NO_RETRY');
}
if(git('rev-parse','HEAD')!==sourceSha||git('status','--porcelain'))throw Error('NATIVE04B_SOURCE_CHANGED');
console.log(JSON.stringify({verdict:'PASS_PROCESS_IPC_ONLY',sourceSha,cases:results.length,evidence:runRoot}));
