import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {compareUpdateVersions,githubReleaseCatalog,githubUpdateRepository,validateUpdateFeed,verifyUpdateManifest,type UpdateFeedConfig,type UpdateManifest} from './update-contract.js';
import type {UpdateState} from '../update-protocol.js';

const MAX_MANIFEST_BYTES=64*1024;
const MAX_RELEASE_CATALOG_BYTES=2*1024*1024;
const readResponse=async(response:Response,limit:number):Promise<unknown>=>{
  const reader=response.body!.getReader();let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('업데이트 정보가 너무 큽니다.');chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};
const releaseManifestUrl=(feed:UpdateFeedConfig,entry:unknown,currentVersion:string):Readonly<{url:string;version:string}>|null=>{
  const github=githubReleaseCatalog(feed);
  if(!github||!Array.isArray(entry))throw new Error('GitHub 릴리스 목록 형식이 올바르지 않습니다.');
  let latest:Record<string,unknown>|null=null,latestVersion='';
  for(const item of entry){
    if(!item||typeof item!=='object'||Array.isArray(item))continue;
    const release=item as Record<string,unknown>;
    if(release.draft!==false||release.prerelease!==(feed.channel==='beta')||typeof release.tag_name!=='string'||!release.tag_name.startsWith('v'))continue;
    const version=release.tag_name.slice(1);
    try{if(compareUpdateVersions(version,currentVersion)<=0||latest&&compareUpdateVersions(version,latestVersion)<=0)continue;}catch{continue;}
    latest=release;latestVersion=version;
  }
  if(!latest)return null;
  if(latest.immutable!==true||!Array.isArray(latest.assets))throw new Error('변경 불가능한 릴리스 자산을 확인하지 못했습니다.');
  const base=`https://github.com/${github.owner}/${github.repo}/releases/download/v${latestVersion}/`;
  for(const name of ['bogunon-update.json',`BOGUNON-DESK-Setup-${latestVersion}-x64.exe`]){
    if(!latest.assets.some(asset=>asset&&typeof asset==='object'&&asset.name===name&&asset.state==='uploaded'&&asset.browser_download_url===base+name))throw new Error('릴리스의 업데이트 파일 구성이 올바르지 않습니다.');
  }
  return {url:base+'bogunon-update.json',version:latestVersion};
};
const request=async(url:string,feed:UpdateFeedConfig,signal:AbortSignal,fetcher:typeof fetch):Promise<Response>=>{
  const github=githubUpdateRepository(feed);
  let current=url;
  for(let redirects=0;redirects<=3;redirects++){
    const response=await fetcher(current,{redirect:github&&!current.startsWith('https://api.github.com/')?'manual':'error',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal});
    if(github&&!current.startsWith('https://api.github.com/')&&[301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      await response.body?.cancel();
      if(!location||redirects===3)throw new Error('업데이트 다운로드 경로가 안전하지 않습니다.');
      const next=new URL(location,current);
      const sameRepository=next.hostname==='github.com'&&next.pathname.startsWith(`/${github.owner}/${github.repo}/releases/download/`)&&!next.search;
      const assetHost=next.hostname==='release-assets.githubusercontent.com'||next.hostname==='objects.githubusercontent.com';
      if(next.protocol!=='https:'||next.username||next.password||next.port&&next.port!=='443'||next.hash||!sameRepository&&!assetHost)throw new Error('업데이트 다운로드 경로가 안전하지 않습니다.');
      current=next.href;
      continue;
    }
    if(!response.ok||!response.body)throw new Error('업데이트 서버에 연결하지 못했습니다. 나중에 다시 시도해 주세요.');
    return response;
  }
  throw new Error('업데이트 다운로드 경로가 안전하지 않습니다.');
};

export async function readUpdateFeed(path:string):Promise<UpdateFeedConfig|null>{
  try{return validateUpdateFeed(JSON.parse(await readFile(path,'utf8')));}catch{return null;}
}

export class UpdateService{
  private state:UpdateState;
  private candidate:UpdateManifest|null=null;
  private pending:AbortController|null=null;
  private downloadedPath:string|null=null;
  private installPending=false;
  constructor(private readonly options:Readonly<{
    currentVersion:string;
    feed:UpdateFeedConfig|null;
    cacheDir:string;
    enabled:boolean;
    emit:(state:UpdateState)=>void;
    fetcher?:typeof fetch;
    verifySignature?:(path:string,publisherSubject:string)=>Promise<boolean>;
    confirmClose?:()=>Promise<boolean>;
    launchInstaller?:(path:string,manifest:UpdateManifest)=>Promise<void>;
  }>){
    this.state={phase:options.enabled&&options.feed?'idle':'unavailable',currentVersion:options.currentVersion,message:options.enabled&&options.feed?undefined:'이 실행본에서는 앱 내 업데이트를 사용할 수 없습니다. 기존 설치 파일로 수동 업데이트해 주세요.'};
  }
  status():UpdateState{return this.state;}
  private set(state:UpdateState):UpdateState{this.state=state;this.options.emit(state);return state;}
  async check():Promise<UpdateState>{
    const {feed,currentVersion}=this.options;
    if(!this.options.enabled||!feed)return this.state;
    if(this.pending||this.installPending||this.state.phase==='installing')return this.state;
    const controller=new AbortController();this.pending=controller;
    this.downloadedPath=null;
    this.set({phase:'checking',currentVersion});
    try{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),fetcher=this.options.fetcher??fetch;
      let manifestUrl=feed.manifestUrl,releaseVersion:string|undefined;
      if(githubReleaseCatalog(feed)){
        const response=await request(`${feed.manifestUrl}?per_page=100`,feed,signal,fetcher);
        if(response.headers.get('link')?.includes('rel="next"'))throw new Error('GitHub 릴리스 목록이 너무 길어 업데이트를 확인할 수 없습니다.');
        const release=releaseManifestUrl(feed,await readResponse(response,MAX_RELEASE_CATALOG_BYTES),currentVersion);
        if(!release){this.candidate=null;return this.set({phase:'current',currentVersion,message:'최신 버전을 사용 중입니다.'});}
        manifestUrl=release.url;releaseVersion=release.version;
      }
      const response=await request(manifestUrl,feed,signal,fetcher);
      const manifest=verifyUpdateManifest(await readResponse(response,MAX_MANIFEST_BYTES),feed,currentVersion);
      if(releaseVersion&&manifest.version!==releaseVersion)throw new Error('릴리스 버전과 서명된 업데이트 버전이 다릅니다.');
      if(manifest.schema===2)await this.observeVersion(manifest.version,feed.channel);
      if(compareUpdateVersions(manifest.version,currentVersion)===0){this.candidate=null;return this.set({phase:'current',currentVersion,message:'최신 버전을 사용 중입니다.'});}
      this.candidate=manifest;
      return this.set({phase:'available',currentVersion,nextVersion:manifest.version,notes:manifest.notes});
    }catch(error){this.candidate=null;return this.set({phase:'failed',currentVersion,message:error instanceof Error?error.message:'업데이트 확인에 실패했습니다.'});}
    finally{this.pending=null;}
  }
  async download():Promise<UpdateState>{
    const candidate=this.candidate,{currentVersion}=this.options;
    if(!this.options.enabled||!candidate||this.pending||this.installPending||this.state.phase!=='available'&&this.state.phase!=='failed')return this.state;
    const controller=new AbortController();this.pending=controller;
    this.downloadedPath=null;
    const filename=`BOGUNON-DESK-Setup-${candidate.version}-${candidate.sha256.slice(0,12)}-x64.exe`;
    const destination=join(this.options.cacheDir,filename);
    const temporary=join(this.options.cacheDir,`${filename}.${randomUUID()}.partial`);
    this.set({phase:'downloading',currentVersion,nextVersion:candidate.version,notes:candidate.notes,progress:0});
    try{
      await mkdir(this.options.cacheDir,{recursive:true});
      try{if((await stat(destination)).size===candidate.size&&await this.hashFile(destination)===candidate.sha256){this.downloadedPath=destination;return this.ready(candidate);}}catch{}
      const feed=this.options.feed;
      if(!feed)throw new Error('업데이트 설정을 확인할 수 없습니다.');
      const response=await request(candidate.url,feed,AbortSignal.any([controller.signal,AbortSignal.timeout(10*60*1000)]),this.options.fetcher??fetch);
      const reader=response.body!.getReader(),file=await open(temporary,'wx');
      const hash=createHash('sha256');let total=0;
      try{
        for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>candidate.size)throw new Error('다운로드 크기가 업데이트 정보와 다릅니다.');hash.update(value);let offset=0;while(offset<value.byteLength){const written=await file.write(value,offset,value.byteLength-offset,null);offset+=written.bytesWritten;}this.set({phase:'downloading',currentVersion,nextVersion:candidate.version,notes:candidate.notes,progress:Math.floor(total/candidate.size*100)});}
      }finally{await file.close();}
      if(total!==candidate.size||hash.digest('hex')!==candidate.sha256)throw new Error('다운로드 파일의 무결성을 확인하지 못했습니다.');
      await rename(temporary,destination);
      this.downloadedPath=destination;
      return this.ready(candidate);
    }catch(error){return this.set({phase:controller.signal.aborted?'available':'failed',currentVersion,nextVersion:candidate.version,notes:candidate.notes,message:controller.signal.aborted?'다운로드를 취소했습니다.':error instanceof Error?error.message:'다운로드에 실패했습니다.'});}
    finally{await rm(temporary,{force:true}).catch(()=>{});this.pending=null;}
  }
  cancel():UpdateState{this.pending?.abort();return this.state;}
  async install():Promise<UpdateState>{
    const {feed,currentVersion,verifySignature,confirmClose,launchInstaller}=this.options;
    if(this.state.phase!=='ready'||!this.candidate||!this.downloadedPath||this.pending||this.installPending)return this.state;
    this.installPending=true;
    const ready=this.state;
    try{
      if(!feed||!confirmClose||!launchInstaller||this.candidate.schema!==2&&(!feed.publisherSubject||!verifySignature))return this.set({...ready,message:'설치 파일의 서명 검증이 준비되지 않아 앱에서 설치할 수 없습니다. 검증된 설치 파일로 수동 업데이트해 주세요.'});
      verifyUpdateManifest(this.candidate,feed,currentVersion);
      if((await stat(this.downloadedPath)).size!==this.candidate.size||await this.hashFile(this.downloadedPath)!==this.candidate.sha256)return this.set({...ready,message:'다운로드 파일이 변경됐습니다. 다시 다운로드해 주세요.'});
      if(feed.publisherSubject&&(!verifySignature||!await verifySignature(this.downloadedPath,feed.publisherSubject)))return this.set({...ready,message:'Windows 설치 파일의 서명 또는 게시자를 확인하지 못했습니다. 설치하지 않았습니다.'});
      if(!await confirmClose())return this.set({...ready,message:'업데이트 설치를 취소했습니다. 기존 앱과 작업은 유지됩니다.'});
      verifyUpdateManifest(this.candidate,feed,currentVersion);
      if((await stat(this.downloadedPath)).size!==this.candidate.size||await this.hashFile(this.downloadedPath)!==this.candidate.sha256||feed.publisherSubject&&(!verifySignature||!await verifySignature(this.downloadedPath,feed.publisherSubject)))return this.set({...ready,message:'설치 직전 파일 검증에 실패했습니다. 다시 다운로드해 주세요.'});
      const installing=this.set({phase:'installing',currentVersion,nextVersion:this.candidate.version,notes:this.candidate.notes,progress:100,message:'설치 프로그램을 여는 중입니다. 저장된 작업을 유지합니다.'});
      await launchInstaller(this.downloadedPath,this.candidate);
      return installing;
    }catch{return this.set({...ready,message:'설치 프로그램을 열지 못했습니다. 기존 앱은 계속 사용할 수 있습니다.'});}
    finally{this.installPending=false;}
  }
  private ready(manifest:UpdateManifest):UpdateState{
    const installSupported=Boolean((manifest.schema===2||this.options.feed?.publisherSubject&&this.options.verifySignature)&&this.options.confirmClose&&this.options.launchInstaller);
    return this.set({phase:'ready',currentVersion:this.options.currentVersion,nextVersion:manifest.version,notes:manifest.notes,progress:100,installSupported,message:installSupported?'다운로드와 파일 검증이 끝났습니다. 설치 전 서명된 업데이트 정보와 파일 무결성을 다시 확인합니다.':'다운로드와 파일 검증이 완료됐습니다. 설치 신뢰 검증이 준비되기 전에는 앱에서 설치하지 않습니다.'});
  }
  private async hashFile(path:string):Promise<string>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
  private async observeVersion(version:string,channel:UpdateFeedConfig['channel']):Promise<void>{
    const path=join(this.options.cacheDir,`highest-${channel}.json`);
    let previous:string|undefined;
    try{const document=JSON.parse(await readFile(path,'utf8'));if(typeof document.version!=='string')throw Error('Invalid update watermark');previous=document.version;}
    catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw new Error('저장된 업데이트 기준을 확인하지 못했습니다.');}
    if(previous&&compareUpdateVersions(version,previous)<0)throw new Error('이전에 확인한 버전보다 오래된 업데이트 정보입니다.');
    if(previous&&compareUpdateVersions(version,previous)===0)return;
    await mkdir(this.options.cacheDir,{recursive:true});
    const temporary=`${path}.${randomUUID()}.partial`;
    try{await writeFile(temporary,JSON.stringify({version}),{flag:'wx'});await rename(temporary,path);}
    finally{await rm(temporary,{force:true}).catch(()=>{});}
  }
  downloaded():boolean{return this.downloadedPath!==null;}
}
