import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {compareUpdateVersions,validateUpdateFeed,verifyUpdateManifest,type UpdateFeedConfig} from '../main/update-contract.js';
import {UpdateService} from '../main/update-service.js';

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const feed:UpdateFeedConfig={enabled:true,channel:'beta',manifestUrl:'https://updates.example.org/beta/latest.json',publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString()};
const githubFeed:UpdateFeedConfig={...feed,manifestUrl:'https://github.com/school-health-hub/BOGUNON_DESK/releases/download/updates-beta/bogunon-update.json'};
const catalogFeed:UpdateFeedConfig={...feed,manifestUrl:'https://api.github.com/repos/school-health-hub/BOGUNON_DESK/releases'};
const githubInstaller='https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.6/BOGUNON-DESK-Setup-2.0.0-beta.6-x64.exe';
const githubManifest='https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.6/bogunon-update.json';
const catalogRelease=(overrides:Record<string,unknown>={})=>({tag_name:'v2.0.0-beta.6',draft:false,prerelease:true,immutable:true,assets:[{name:'bogunon-update.json',state:'uploaded',browser_download_url:githubManifest},{name:'BOGUNON-DESK-Setup-2.0.0-beta.6-x64.exe',state:'uploaded',browser_download_url:githubInstaller}],...overrides});
const current='2.0.0-beta.5';
const payload=Buffer.from('synthetic QA installer, never executable');
const sha256=createHash('sha256').update(payload).digest('hex');
const manifest=(version='2.0.0-beta.6',overrides:Record<string,unknown>={})=>{
  const base={schema:1,channel:'beta',version,notes:'합성 QA 변경 사항',url:'https://updates.example.org/beta/setup.exe',size:payload.length,sha256,...overrides};
  const signed=JSON.stringify([base.schema,base.channel,base.version,base.notes,base.url,base.size,base.sha256]);
  return {...base,signature:sign(null,Buffer.from(signed),privateKey).toString('base64')};
};
const manifestV2=(version='2.0.0-beta.6',overrides:Record<string,unknown>={},signingKey=privateKey)=>{
  const issuedAt=new Date(Date.now()-60_000).toISOString();
  const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
  const base={schema:2,channel:'beta',version,notes:'합성 QA 변경 사항',url:'https://updates.example.org/beta/setup.exe',size:payload.length,sha256,issuedAt,expiresAt,...overrides};
  const signed=JSON.stringify([base.schema,base.channel,base.version,base.notes,base.url,base.size,base.sha256,base.issuedAt,base.expiresAt]);
  return {...base,signature:sign(null,Buffer.from(signed),signingKey).toString('base64')};
};

describe('signed update contract',()=>{
  it('binds release identity and freshness to the pinned signing key, including a staged rotation key',()=>{
    const next=generateKeyPairSync('ed25519');
    const rotatingFeed={...feed,nextPublicKeyPem:next.publicKey.export({type:'spki',format:'pem'}).toString()};
    expect(validateUpdateFeed(rotatingFeed)).not.toBeNull();
    expect(verifyUpdateManifest(manifestV2('2.0.0-beta.6',{},next.privateKey),rotatingFeed,current).schema).toBe(2);
    expect(()=>verifyUpdateManifest(manifestV2('2.0.0-beta.6',{expiresAt:new Date(Date.now()-60_000).toISOString()}),feed,current)).toThrow('만료');
    expect(()=>verifyUpdateManifest(manifestV2('2.0.0-beta.6',{url:'https://evil.example/setup.exe'}),feed,current)).toThrow('주소');
    expect(()=>verifyUpdateManifest(manifestV2('2.0.0-beta.4'),feed,current)).toThrow('이전 버전');
    expect(()=>verifyUpdateManifest(manifestV2('2.0.0-beta.6',{},next.privateKey),feed,current)).toThrow('서명');
  });
  it('accepts only the configured public GitHub channel and a version-matched release asset',()=>{
    expect(validateUpdateFeed(githubFeed)).not.toBeNull();
    expect(validateUpdateFeed(catalogFeed)).not.toBeNull();
    expect(validateUpdateFeed({...catalogFeed,manifestUrl:'https://api.github.com/repos/other/BOGUNON_DESK/releases?token=secret'})).toBeNull();
    expect(verifyUpdateManifest(manifest('2.0.0-beta.6',{url:githubInstaller}),githubFeed,current).url).toBe(githubInstaller);
    expect(()=>verifyUpdateManifest(manifest('2.0.0-beta.6',{url:'https://github.com/other/repo/releases/download/v2.0.0-beta.6/setup.exe'}),githubFeed,current)).toThrow('주소');
    expect(()=>verifyUpdateManifest(manifest('2.0.0-beta.6',{url:'https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.7/setup.exe'}),githubFeed,current)).toThrow('주소');
    expect(validateUpdateFeed({...githubFeed,manifestUrl:'https://github.com/school-health-hub/BOGUNON_DESK/releases/download/other/bogunon-update.json'})).toBeNull();
  });
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
  it('discovers an immutable versioned GitHub Release and verifies its signed manifest before download',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'catalog-'));
    const signed=manifestV2('2.0.0-beta.6',{url:githubInstaller});
    const visited:string[]=[];
    const fetcher=(async(url:string)=>{
      visited.push(url);
      if(url===`${catalogFeed.manifestUrl}?per_page=100`)return new Response(JSON.stringify([catalogRelease()]));
      if(url===githubManifest)return new Response(JSON.stringify(signed));
      if(url===githubInstaller)return new Response(payload);
      throw Error('Unexpected release URL');
    }) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed:catalogFeed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    expect((await service.check()).phase).toBe('available');
    expect((await service.download()).phase).toBe('ready');
    expect(visited).toEqual([`${catalogFeed.manifestUrl}?per_page=100`,githubManifest,githubInstaller]);
  });
  it.each([
    ['mutable release',{immutable:false},manifestV2('2.0.0-beta.6',{url:githubInstaller})],
    ['missing signed asset',{assets:[]},manifestV2('2.0.0-beta.6',{url:githubInstaller})],
    ['mismatched signed version',{},manifestV2('2.0.0-beta.7',{url:'https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.7/BOGUNON-DESK-Setup-2.0.0-beta.7-x64.exe'})]
  ])('rejects %s from release discovery',async(_label,overrides,signed)=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'catalog-reject-'));
    const fetcher=(async(url:string)=>new Response(url.startsWith('https://api.github.com/')?JSON.stringify([catalogRelease(overrides)]):JSON.stringify(signed))) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed:catalogFeed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    expect((await service.check()).phase).toBe('failed');
  });
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
  it('follows only bounded GitHub HTTPS asset redirects without forwarding credentials',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'github-'));
    const signed=manifest('2.0.0-beta.6',{url:githubInstaller});
    const cdn='https://release-assets.githubusercontent.com/asset?token=synthetic';
    const calls:{readonly url:string;readonly redirect:RequestRedirect|undefined;readonly headers:HeadersInit|undefined}[]=[];
    const fetcher=(async(url:string,init?:RequestInit)=>{
      calls.push({url,redirect:init?.redirect,headers:init?.headers});
      if(url===githubFeed.manifestUrl||url===githubInstaller)return new Response(null,{status:302,headers:{location:cdn}});
      if(url===cdn)return new Response(calls.length===2?JSON.stringify(signed):payload);
      throw Error('unexpected URL');
    }) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed:githubFeed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    expect((await service.check()).phase).toBe('available');
    expect((await service.download()).phase).toBe('ready');
    expect(calls).toHaveLength(4);
    expect(calls.every(call=>call.redirect==='manual'&&call.headers===undefined)).toBe(true);
  });
  it.each(['http://release-assets.githubusercontent.com/asset','https://evil.example/asset','https://github.com/other/repo/releases/download/v2/setup.exe'])('rejects an unsafe GitHub redirect to %s',async location=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'github-block-'));
    const fetcher=(async()=>new Response(null,{status:302,headers:{location}})) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed:githubFeed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    expect((await service.check()).phase).toBe('failed');
    expect(await readdir(root)).toEqual([]);
  });
  it('stops a GitHub redirect loop after three hops',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'github-loop-'));
    let calls=0;
    const fetcher=(async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/asset'}});}) as typeof fetch;
    const service=new UpdateService({currentVersion:current,feed:githubFeed,cacheDir:root,enabled:true,emit:()=>{},fetcher});
    expect((await service.check()).phase).toBe('failed');
    expect(calls).toBe(4);
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
  it('keeps unsigned updates downloaded but blocks installer launch',async()=>{
    const service=await setup();
    await service.check();await service.download();
    expect((await service.install()).phase).toBe('ready');
    expect(service.status().message).toContain('서명');
  });
  it('permits installer handoff only for a fresh signed v2 manifest without an Authenticode publisher',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'v2-install-'));
    const confirmClose=vi.fn(async()=>true);
    const launchInstaller=vi.fn(async()=>{});
    const service=new UpdateService({currentVersion:current,feed,cacheDir:root,enabled:true,emit:()=>{},fetcher:(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify(manifestV2()):payload)) as typeof fetch,confirmClose,launchInstaller});
    expect((await service.check()).phase).toBe('available');
    const ready=await service.download();expect(ready.phase).toBe('ready');expect(ready.installSupported).toBe(true);
    expect((await service.install()).phase).toBe('installing');
    expect(confirmClose).toHaveBeenCalledTimes(1);
    expect(launchInstaller).toHaveBeenCalledTimes(1);
  });
  it('rejects a previously superseded signed release after app restart',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'replay-'));
    let offered='2.0.0-beta.7';
    const options={currentVersion:current,feed,cacheDir:root,enabled:true,emit:()=>{},fetcher:(async()=>new Response(JSON.stringify(manifestV2(offered)))) as typeof fetch};
    expect((await new UpdateService(options).check()).phase).toBe('available');
    offered='2.0.0-beta.6';
    expect((await new UpdateService(options).check()).phase).toBe('failed');
  });
  it('requires a valid publisher, unchanged hash and explicit save confirmation before launch',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'install-'));
    const signedFeed={...feed,publisherSubject:'CN=BOGUNON QA'};
    let trusted=true,confirmed=false;
    const verifySignature=vi.fn(async()=>trusted);
    const confirmClose=vi.fn(async()=>confirmed);
    const launchInstaller=vi.fn(async()=>{});
    const service=new UpdateService({currentVersion:current,feed:signedFeed,cacheDir:root,enabled:true,emit:()=>{},fetcher:(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify(manifest()):payload)) as typeof fetch,verifySignature,confirmClose,launchInstaller});
    await service.check();expect((await service.download()).phase).toBe('ready');
    trusted=false;expect((await service.install()).phase).toBe('ready');expect(launchInstaller).not.toHaveBeenCalled();
    trusted=true;expect((await service.install()).phase).toBe('ready');expect(confirmClose).toHaveBeenCalledTimes(1);expect(launchInstaller).not.toHaveBeenCalled();
    confirmed=true;expect((await service.install()).phase).toBe('installing');expect(launchInstaller).toHaveBeenCalledTimes(1);
  });
  it('refuses a cached installer altered after download',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'install-tamper-'));
    const launchInstaller=vi.fn(async()=>{});
    const service=new UpdateService({currentVersion:current,feed:{...feed,publisherSubject:'CN=BOGUNON QA'},cacheDir:root,enabled:true,emit:()=>{},fetcher:(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify(manifest()):payload)) as typeof fetch,verifySignature:async()=>true,confirmClose:async()=>true,launchInstaller});
    await service.check();await service.download();
    const names=await readdir(root);await writeFile(join(root,names[0]),'tampered');
    expect((await service.install()).phase).toBe('ready');expect(launchInstaller).not.toHaveBeenCalled();
  });
  it('does not start two installers when installation is requested twice',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'install-once-'));
    let release:()=>void=()=>{};
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const verifySignature=vi.fn(async()=>{await gate;return true;});
    const launchInstaller=vi.fn(async()=>{});
    const service=new UpdateService({currentVersion:current,feed:{...feed,publisherSubject:'CN=BOGUNON QA'},cacheDir:root,enabled:true,emit:()=>{},fetcher:(async(url:string)=>new Response(url===feed.manifestUrl?JSON.stringify(manifest()):payload)) as typeof fetch,verifySignature,confirmClose:async()=>true,launchInstaller});
    await service.check();await service.download();
    const first=service.install();const second=service.install();
    release();await Promise.all([first,second]);
    expect(verifySignature).toHaveBeenCalledTimes(2);
    expect(launchInstaller).toHaveBeenCalledTimes(1);
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
  it('signs only the matching versioned GitHub Release asset',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'github-signer-'));
    await mkdir(join(root,'config'));await mkdir(join(root,'electron-p0'));
    await writeFile(join(root,'config','production-electron-update.json'),JSON.stringify(githubFeed));
    await writeFile(join(root,'electron-p0','package.json'),JSON.stringify({version:'2.0.0-beta.6'}));
    const installer=join(root,'BOGUNON-DESK-Setup-2.0.0-beta.6-x64.exe'),notes=join(root,'notes.txt'),output=join(root,'bogunon-update.json');
    await writeFile(installer,payload);await writeFile(notes,'합성 QA 변경 사항');
    const script=resolve('scripts/electron-p0/sign-update-manifest.mjs');
    const env={...process.env,BOGUNON_UPDATE_SIGN_KEY:privateKey.export({type:'pkcs8',format:'pem'}).toString()};
    expect(()=>execFileSync(process.execPath,[script,installer,'https://github.com/other/repo/releases/download/v2.0.0-beta.6/',notes,output],{cwd:root,env,stdio:'pipe'})).toThrow();
    execFileSync(process.execPath,[script,installer,'https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.6/',notes,output],{cwd:root,env});
    expect(verifyUpdateManifest(JSON.parse(await readFile(output,'utf8')),githubFeed,current).url).toBe(githubInstaller);
  });
  it('signs versioned assets when the feed discovers immutable GitHub Releases',async()=>{
    const base=process.env.UPDATE_QA_TEMP;if(!base)throw new Error('Set UPDATE_QA_TEMP');
    root=await mkdtemp(join(base,'catalog-signer-'));
    await mkdir(join(root,'config'));await mkdir(join(root,'electron-p0'));
    await writeFile(join(root,'config','production-electron-update.json'),JSON.stringify(catalogFeed));
    await writeFile(join(root,'electron-p0','package.json'),JSON.stringify({version:'2.0.0-beta.6'}));
    const installer=join(root,'BOGUNON-DESK-Setup-2.0.0-beta.6-x64.exe'),notes=join(root,'notes.txt'),output=join(root,'bogunon-update.json');
    await writeFile(installer,payload);await writeFile(notes,'합성 QA 변경 사항');
    execFileSync(process.execPath,[resolve('scripts/electron-p0/sign-update-manifest.mjs'),installer,'https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.6/',notes,output],{cwd:root,env:{...process.env,BOGUNON_UPDATE_SIGN_KEY:privateKey.export({type:'pkcs8',format:'pem'}).toString()}});
    expect(verifyUpdateManifest(JSON.parse(await readFile(output,'utf8')),catalogFeed,current).url).toBe(githubInstaller);
  });
});
