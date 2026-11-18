import {readFile,writeFile,mkdir,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const exec=promisify(execFile);
export function createNative(root,launcherPid){return async(action,name,file='',expectedHash='',extra=[])=>{
 assert.match(name,/^[a-z0-9-]+$/);const c=await statfs('C:/');assert(c.bavail*c.bsize>1024**3);
 const bytes=await readFile(join(root,'control/native-dialog.ps1')),scriptSha256=createHash('sha256').update(bytes).digest('hex');
 assert(bytes.subarray(0,3).equals(Buffer.from([239,187,191])),'PowerShell UTF-8 BOM required');
 const dir=join(root,'control/versions');await mkdir(dir,{recursive:true});const script=join(dir,scriptSha256+'.ps1');
 try{await writeFile(script,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert((await readFile(script)).equals(bytes));}
 const args=['-NoProfile','-File',script,'-Action',action,'-LauncherPid',String(launcherPid),'-QaRoot',root,'-Evidence',name,'-ExpectedLauncher',process.env.QA_PORTABLE_PATH,'-AllowedQaParent',process.env.QA_ALLOWED_PARENT,'-CdpPort',process.env.QA_CDP_PORT??'15448'];
 if(file)args.push('-FilePath',file);if(expectedHash)args.push('-ExpectedFileHash',expectedHash);args.push(...extra);
 const temp=join(root,'temp'),env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,RUNNER_TEMP:temp};
 try{const {stdout}=await exec(join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),args,{env,windowsHide:true,timeout:30000,maxBuffer:2*1024**2});return {scriptSha256,...JSON.parse(stdout.replace(/^\uFEFF/,''))};}
 catch(error){await writeFile(join(root,'results',name+'-tool-error.json'),JSON.stringify({action,scriptSha256,error:String(error.stack??error),stderr:error.stderr},null,2));throw error;}
};}
