import {afterEach,describe,expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile,mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {startVerifiedUpdateInstaller} from '../main/update-installer.js';

describe.skipIf(process.platform!=='win32')('isolated Windows update handoff',()=>{
  let root:string|undefined;
  let base:string|undefined;
  afterEach(async()=>{
    if(!root||!base)return;
    if(!resolve(root).startsWith(`${resolve(base)}${sep}`))throw new Error('QA cleanup escaped the temporary root');
    await rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50});
    root=undefined;
  });
  const outcome=async(path:string):Promise<string>=>{
    for(let attempt=0;attempt<100;attempt++){
      try{const state=await readFile(path,'utf8');if(state&&state!=='armed')return state;}
      catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error('Update handoff did not write an outcome');
  };
  it('reports a verified synthetic executable rejecting silent install',async()=>{
    const configured=process.env.UPDATE_QA_TEMP,systemRoot=process.env.SystemRoot;
    if(!configured||!systemRoot)throw new Error('Set UPDATE_QA_TEMP and SystemRoot');
    base=configured;root=await mkdtemp(join(configured,'installer-'));
    const source=join(systemRoot,'System32','whoami.exe');
    const installer=join(root,'synthetic-setup.exe'),application=join(root,'synthetic-app.exe'),result=join(root,'result.txt');
    await copyFile(source,installer);await copyFile(source,application);
    const bytes=await readFile(installer);
    const version=execFileSync(join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command','[Console]::Out.Write([Diagnostics.FileVersionInfo]::GetVersionInfo($env:BOGUNON_QA_EXE).FileVersion)'],{encoding:'utf8',windowsHide:true,env:{...process.env,BOGUNON_QA_EXE:application}}).trim();
    await startVerifiedUpdateInstaller({installerPath:installer,applicationPath:application,resultPath:result,parentPid:2147483647,currentVersion:'0.0.1',nextVersion:version,size:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')});
    expect(version.length).toBeGreaterThan(0);
    expect(await outcome(result)).toBe('installer-failed');
  });
  it('rejects changed installer bytes before executing them',async()=>{
    const configured=process.env.UPDATE_QA_TEMP,systemRoot=process.env.SystemRoot;
    if(!configured||!systemRoot)throw new Error('Set UPDATE_QA_TEMP and SystemRoot');
    base=configured;root=await mkdtemp(join(configured,'installer-reject-'));
    const installer=join(root,'synthetic-setup.exe'),application=join(root,'synthetic-app.exe'),result=join(root,'result.txt');
    await copyFile(join(systemRoot,'System32','whoami.exe'),installer);await copyFile(installer,application);
    const bytes=await readFile(installer);
    await startVerifiedUpdateInstaller({installerPath:installer,applicationPath:application,resultPath:result,parentPid:2147483647,currentVersion:'0.0.1',nextVersion:'0.0.2',size:bytes.byteLength,sha256:'0'.repeat(64)});
    expect(await outcome(result)).toBe('rejected-hash');
  });
});
