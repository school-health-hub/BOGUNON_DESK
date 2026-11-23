import {afterEach,describe,expect,it} from 'vitest';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {compareUpdateVersions,validateUpdateFeed,verifyUpdateManifest,type UpdateFeedConfig} from '../main/update-contract.js';
import {UpdateService} from '../main/update-service.js';

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const feed:UpdateFeedConfig={enabled:true,channel:'beta',manifestUrl:'https://updates.example.org/beta/latest.json',publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString()};
const current='2.0.0-beta.5';
const payload=Buffer.from('synthetic QA installer, never executable');
const sha256=createHash('sha256').update(payload).digest('hex');
const manifest=(version='2.0.0-beta.6',overrides:Record<string,unknown>={})=>{
  const base={schema:1,channel:'beta',version,notes:'합성 QA 변경 사항',url:'https://updates.example.org/beta/setup.exe',size:payload.length,sha256,...overrides};
  const signed=JSON.stringify([base.schema,base.channel,base.version,base.notes,base.url,base.size,base.sha256]);
  return {...base,signature:sign(null,Buffer.from(signed),privateKey).toString('base64')};
};

describe('signed update contract',()=>{
  it('orders prereleases, stable versions and equal versions without downgrade',()=>{
    expect(compareUpdateVersions('2.0.0-beta.6',current)).toBe(1);
    expect(compareUpdateVersions('2.0.0','2.0.0-beta.99')).toBe(1);
    expect(compareUpdateVersions(current,current)).toBe(0);
    expect(compareUpdateVersions('2.0.0-beta.4',current)).toBe(-1);
  });
  it('rejects unsigned, tampered, redirected and downgraded metadata',()=>{
    expect(verifyUpdateManifest(manifest(),feed,current).version).toBe('2.0.0-beta.6');
    expect(()=>verifyUpdateManifest({...manifest(),notes:'변조'},feed,current)).toThrow('서명');
    expect(()=>verifyUpdateManifest(manifest('2.0.0-beta.4'),feed,current)).toThrow('이전 버전');
    expect(()=>verifyUpdateManifest(manifest('2.0.0-beta.6',{url:'https://evil.example/setup.exe'}),feed,current)).toThrow('주소');
    expect(validateUpdateFeed({...feed,manifestUrl:'http://updates.example.org/latest.json'})).toBeNull();
    expect(()=>verifyUpdateManifest({...manifest(),signature:''},feed,current)).toThrow('서명');
    expect(()=>verifyUpdateManifest(manifest('2.0.0-beta.6',{url:'https://updates.example.org/beta/setup.exe?token=secret'}),feed,current)).toThrow('주소');
  });
});

describe('isolated update lifecycle',()=>{
  let root:string|undefined;
  afterEach(async()=>{if(root)await rm(root,{recursive:true,force:true});root=undefined;});
  const setup=async(content=payload,metadata=manifest())=>{
    const base=process.env.UPDATE_QA_TEMP;
    if(!base)throw new Error('Set UPDATE_QA_TEMP to an isolated QA directory');
    root=await mkdtemp(join(base,'update-'));
    const fetcher=(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify(metadata):content)) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    return service;
  };
  it('checks, downloads only after consent, verifies hash, and leaves unrelated files alone',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'update-'));
    const seen:string[]=[];
    const fetcher=(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify(manifest()):payload)) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed,cacheDir:root,enabled:true,emit:state=>seen.push(`${state.phase}:${state.progress??'-'}`),fetcher});
    expect(service.status().phase).toBe('idle');
    expect(await readdir(root!)).toEqual([]);
    expect((await service.check()).phase).toBe('available');
    expect(await readdir(root!)).toEqual([]);
    expect((await service.download()).phase).toBe('ready');
    const names=await readdir(root!);
    expect(names).toHaveLength(1);
    expect(await readFile(join(root!,names[0]))).toEqual(payload);
    expect(seen).toContain('checking:-');
    expect(seen).toContain('downloading:100');
    expect(seen).toContain('ready:100');
  });
  it('rejects a damaged file and allows retry without keeping a partial installer',async()=>{
    let corrupted=true;
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'update-'));
    const fetcher=(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify(manifest()):corrupted?Buffer.from('bad'):payload)) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    await service.check();expect((await service.download()).phase).toBe('failed');expect(await readdir(root)).toEqual([]);
    corrupted=false;expect((await service.download()).phase).toBe('ready');
  });
  it('keeps the installed app usable when feed is disabled or invalid',async()=>{
    const service=new UpdateService({currentVersion:current,feed:null,cacheDir:'unused',enabled:false,emit:()=>{},fetcher:(async()=>{throw Error('unexpected network');}) as typeof fetch});
    expect((await service.check()).phase).toBe('unavailable');
    expect((await service.download()).phase).toBe('unavailable');
  });
  it('reports the current version and does not download it',async()=>{
    const service=await setup(payload,manifest(current));
    expect((await service.check()).phase).toBe('current');
    expect((await service.download()).phase).toBe('current');
    expect(await readdir(root!)).toEqual([]);
  });
  it('keeps the existing version available after a network error',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'update-'));
    const service=new UpdateService({currentVersion:current,feed,cacheDir:root,enabled:true,emit:()=>{},fetcher:(async()=>{throw Error('offline');}) as typeof fetch});
    expect((await service.check()).phase).toBe('failed');
    expect(service.status().currentVersion).toBe(current);
    expect(await readdir(root)).toEqual([]);
  });
  it('does not allow a download before a signed update is discovered',async()=>{
    const service=await setup();
    expect((await service.download()).phase).toBe('idle');
    expect(await readdir(root!)).toEqual([]);
  });
  it('cancels an in-flight download and leaves no partial file',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'update-'));
    const fetcher=(async(url:string,init?:RequestInit)=>url===feed.manifestUrl?new Response(JSON.stringify(manifest())):new Promise<Response>((_resolve,reject)=>{const signal=init?.signal as AbortSignal;if(signal.aborted){reject(new Error('cancelled'));return;}signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});})) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    await service.check();const pending=service.download();service.cancel();
    expect((await pending).phase).toBe('available');
    expect(await readdir(root)).toEqual([]);
  });
  it('signs a synthetic release manifest with the matching private key only',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'signer-'));
    await mkdir(join(root,'config'));await mkdir(join(root,'electron-p0'));
    await writeFile(join(root,'config','production-electron-update.json'),JSON.stringify(feed));
    await writeFile(join(root,'electron-p0','package.json'),JSON.stringify({version:'2.0.0-beta.6'}));
    const installer=join(root,'BOGUNON-DESK-Setup-2.0.0-beta.6-x64.exe'),notes=join(root,'notes.txt'),output=join(root,'latest.json');
    await writeFile(installer,payload);await writeFile(notes,'합성 QA 변경 사항');
    execFileSync(process.execPath,[resolve('scripts/electron-p0/sign-update-manifest.mjs'),installer,'https://updates.example.org/beta/',notes,output],{cwd:root,env:{...process.env,BOGUNON_UPDATE_SIGN_KEY:privateKey.export({type:'pkcs8',format:'pem'}).toString()}});
    const signed=verifyUpdateManifest(JSON.parse(await readFile(output,'utf8')),feed,current);
    expect(signed.sha256).toBe(sha256);
    expect(signed.size).toBe(payload.byteLength);
  });
});
