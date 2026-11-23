import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readFile,rename,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {compareUpdateVersions,validateUpdateFeed,verifyUpdateManifest,type UpdateFeedConfig,type UpdateManifest} from './update-contract.js';
import type {UpdateState} from '../update-protocol.js';

const MAX_MANIFEST_BYTES=64*1024;
const request=async(url:string,signal:AbortSignal,fetcher:typeof fetch):Promise<Response>=>{
  const response=await fetcher(url,{redirect:'error',cache:'no-store',signal});
  if(!response.ok||!response.body)throw new Error('업데이트 서버에 연결하지 못했습니다. 나중에 다시 시도해 주세요.');
  return response;
};

export async function readUpdateFeed(path:string):Promise<UpdateFeedConfig|null>{
  try{return validateUpdateFeed(JSON.parse(await readFile(path,'utf8')));}catch{return null;}
}

export class UpdateService{
  private state:UpdateState;
  private candidate:UpdateManifest|null=null;
  private pending:AbortController|null=null;
  private downloadedPath:string|null=null;
  constructor(private readonly options:Readonly<{
    currentVersion:string;
    feed:UpdateFeedConfig|null;
    cacheDir:string;
    enabled:boolean;
    emit:(state:UpdateState)=>void;
    fetcher?:typeof fetch;
  }>){
    this.state={phase:options.enabled&&options.feed?'idle':'unavailable',currentVersion:options.currentVersion,message:options.enabled&&options.feed?undefined:'이 실행본에서는 앱 내 업데이트를 사용할 수 없습니다. 기존 설치 파일로 수동 업데이트해 주세요.'};
  }
  status():UpdateState{return this.state;}
  private set(state:UpdateState):UpdateState{this.state=state;this.options.emit(state);return state;}
  async check():Promise<UpdateState>{
    const {feed,currentVersion}=this.options;
    if(!this.options.enabled||!feed)return this.state;
    if(this.pending)return this.state;
    const controller=new AbortController();this.pending=controller;
    this.set({phase:'checking',currentVersion});
    try{
      const response=await request(feed.manifestUrl,AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),this.options.fetcher??fetch);
      const reader=response.body!.getReader();let size=0;const chunks:Uint8Array[]=[];
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_MANIFEST_BYTES)throw new Error('업데이트 정보가 너무 큽니다.');chunks.push(value);}
      const manifest=verifyUpdateManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')),feed,currentVersion);
      if(compareUpdateVersions(manifest.version,currentVersion)===0){this.candidate=null;return this.set({phase:'current',currentVersion,message:'최신 버전을 사용 중입니다.'});}
      this.candidate=manifest;
      return this.set({phase:'available',currentVersion,nextVersion:manifest.version,notes:manifest.notes});
    }catch(error){this.candidate=null;return this.set({phase:'failed',currentVersion,message:error instanceof Error?error.message:'업데이트 확인에 실패했습니다.'});}
    finally{this.pending=null;}
  }
  async download():Promise<UpdateState>{
    const candidate=this.candidate,{currentVersion}=this.options;
    if(!this.options.enabled||!candidate||this.pending||this.state.phase!=='available'&&this.state.phase!=='failed')return this.state;
    const controller=new AbortController();this.pending=controller;
    const filename=`BOGUNON-DESK-Setup-${candidate.version}-${candidate.sha256.slice(0,12)}-x64.exe`;
    const destination=join(this.options.cacheDir,filename);
    const temporary=join(this.options.cacheDir,`${filename}.${randomUUID()}.partial`);
    this.set({phase:'downloading',currentVersion,nextVersion:candidate.version,notes:candidate.notes,progress:0});
    try{
      await mkdir(this.options.cacheDir,{recursive:true});
      try{if((await stat(destination)).size===candidate.size&&await this.hashFile(destination)===candidate.sha256){this.downloadedPath=destination;return this.ready(candidate);}}catch{}
      const response=await request(candidate.url,AbortSignal.any([controller.signal,AbortSignal.timeout(10*60*1000)]),this.options.fetcher??fetch);
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
  private ready(manifest:UpdateManifest):UpdateState{return this.set({phase:'ready',currentVersion:this.options.currentVersion,nextVersion:manifest.version,notes:manifest.notes,progress:100,message:'다운로드와 파일 검증이 완료됐습니다. 서명된 설치본 검증 전에는 앱에서 자동 설치하지 않습니다.'});}
  private async hashFile(path:string):Promise<string>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
  downloaded():boolean{return this.downloadedPath!==null;}
}
