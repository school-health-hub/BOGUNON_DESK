import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import {UpdateService} from '../main/update-service.js';
import {startVerifiedUpdateInstaller} from '../main/update-installer.js';

const root=process.env.UPDATE_QA_NSIS_ROOT;

describe.skipIf(process.platform!=='win32'||!root)('separate-identity NSIS update',()=>{
  it('updates synthetic A to B after signed download and preserves synthetic data',async()=>{
    if(!root)throw new Error('Set UPDATE_QA_NSIS_ROOT');
    const installer=join(root,'release-b','BOGUNON-UPDATE-QA-Setup-2.0.0-beta.91-x64.exe');
    const application=join(process.env.LOCALAPPDATA??'', 'Programs','BOGUNON UPDATE ISOLATED QA','BOGUNON UPDATE ISOLATED QA.exe');
    const profile=join(root,'synthetic-profile');
    const memo=join(profile,'synthetic-memo.txt');
    const cache=join(root,'download-cache');
    const result=join(root,'nsis-result.txt');
    const current='2.0.0-beta.90',next='2.0.0-beta.91';
    const version=()=>execFileSync(join(process.env.SystemRoot??'', 'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command','[Console]::Out.Write([Diagnostics.FileVersionInfo]::GetVersionInfo($env:BOGUNON_QA_EXE).FileVersion)'],{env:{...process.env,BOGUNON_QA_EXE:application},encoding:'utf8',windowsHide:true}).trim();
    expect(version()).toBe(current);
    await mkdir(profile,{recursive:true});
    try { await writeFile(memo,'synthetic update retention fixture\n',{flag:'wx'}); }
    catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='EEXIST'))throw error;}
    const before=createHash('sha256').update(await readFile(memo)).digest('hex');
    const bytes=await readFile(installer);
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const {privateKey,publicKey}=generateKeyPairSync('ed25519');
    const feed={enabled:true as const,channel:'beta' as const,manifestUrl:'https://updates.example.org/beta/latest.json',publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString()};
    const issuedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
    const payload={schema:2 as const,channel:'beta' as const,version:next,notes:'합성 격리 업데이트',url:`https://updates.example.org/beta/BOGUNON-UPDATE-QA-Setup-${next}-x64.exe`,size:bytes.byteLength,sha256,issuedAt,expiresAt};
    const signature=sign(null,Buffer.from(JSON.stringify([payload.schema,payload.channel,payload.version,payload.notes,payload.url,payload.size,payload.sha256,payload.issuedAt,payload.expiresAt])),privateKey).toString('base64');
    const fetcher=(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify({...payload,signature}):bytes)) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed,cacheDir:cache,enabled:true,emit:()=>{},fetcher,confirmClose:async()=>true,launchInstaller:async(path,manifest)=>startVerifiedUpdateInstaller({installerPath:path,applicationPath:application,resultPath:result,parentPid:2147483647,currentVersion:current,nextVersion:manifest.version,size:manifest.size,sha256:manifest.sha256})});
    expect((await service.check()).phase).toBe('available');
    expect((await service.download()).phase).toBe('ready');
    expect((await service.install()).phase).toBe('installing');
    let outcome='armed';
    const terminal=(state:string)=>state.startsWith('installed:')||state==='rejected-hash'||/-failed$|-timeout$/.test(state);
    for(let attempt=0;attempt<600&&!terminal(outcome);attempt++){
      outcome=await readFile(result,'utf8');
      if(!terminal(outcome))await new Promise(resolve=>setTimeout(resolve,100));
    }
    expect(outcome).toBe(`installed:${next}`);
    expect(version()).toBe(next);
    expect(createHash('sha256').update(await readFile(memo)).digest('hex')).toBe(before);
  },120000);
});
