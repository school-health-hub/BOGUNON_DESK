import {randomUUID} from 'node:crypto';
import type {FinderSearchPage,FinderSearchStatus,YoutubeVideo} from '../finder-search-protocol.js';
import type {EducationVideoLibrary,IpcResult} from '../protocol.js';import {assertSender} from './policy.js';
import type {YoutubeVault} from './finder-vault.js';
import {FINDER_ERRORS,FinderSearchError,searchYoutube,validVideoId,validYoutubeKey,validateFinderConditions,type YoutubeFetch} from './finder-youtube.js';
type Ports={vault:YoutubeVault;fetch:YoutubeFetch;readClipboard:()=>string|Promise<string>;clearClipboard:(expected:string)=>Promise<void>;reviewKey:(remember:boolean)=>Promise<boolean>;reviewSearch:(query:string,page:number)=>Promise<boolean>;openExternal:(url:string)=>Promise<void>;library:()=>Promise<EducationVideoLibrary>;timeoutMs?:number};
// Cancel the owned wait, not an unrelated OS dialog. A late answer cannot start
// a request or write a key after cancellation; no new timeout or approval bypass.
function waitForApproval(signal:AbortSignal,ask:()=>Promise<boolean>):Promise<boolean>{
 return new Promise((resolve,reject)=>{
  const cancel=()=>{signal.removeEventListener('abort',cancel);reject(new FinderSearchError(FINDER_ERRORS.cancel));};
  if(signal.aborted){cancel();return;}signal.addEventListener('abort',cancel,{once:true});
  try{ask().then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});}
  catch(error){signal.removeEventListener('abort',cancel);reject(error);}
 });
}
export class FinderSearchService{
 private key:string|undefined;private busy=false;private disposed=false;private generation=0;private controller:AbortController|undefined;
 private pageState:{fingerprint:string;page:number;cursor:string;token:string;seen:Set<string>}|undefined;
 private readonly known=new Map<string,YoutubeVideo>();private readonly pending=new Set<Promise<unknown>>();
 constructor(private readonly ports:Ports){}
 private fresh(token:number){if(this.disposed||token!==this.generation||this.controller?.signal.aborted)throw new FinderSearchError(FINDER_ERRORS.cancel);}
 private operation<T>(task:(signal:AbortSignal,token:number)=>Promise<T>):Promise<T>{
  if(this.disposed)return Promise.reject(new FinderSearchError(FINDER_ERRORS.cancel));if(this.busy)return Promise.reject(new FinderSearchError(FINDER_ERRORS.busy));this.busy=true;this.controller=new AbortController();const token=++this.generation,signal=this.controller.signal;
  const pending=(async()=>{try{return await task(signal,token);}finally{this.busy=false;this.controller=undefined;}})();this.pending.add(pending);void pending.finally(()=>this.pending.delete(pending)).catch(()=>{});return pending;
 }
 async status():Promise<FinderSearchStatus>{return {provider:'youtube-data-v3',configured:!!this.key&&!this.disposed,secureStorage:this.ports.vault.available,saved:await this.ports.vault.exists()};}
 connect(input:unknown){return this.operation(async(signal,token)=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).join(',')!=='remember'||typeof (input as {remember:unknown}).remember!=='boolean')throw new FinderSearchError(FINDER_ERRORS.invalid);const remember=(input as {remember:boolean}).remember;
  if(remember&&!this.ports.vault.available)throw new FinderSearchError('Windows 보안 저장을 사용할 수 없습니다. 이 실행 동안만 연결해 주세요.');
  const key=(await this.ports.readClipboard()).trim();this.fresh(token);if(!validYoutubeKey(key))throw new FinderSearchError(FINDER_ERRORS.key);
  if(!await waitForApproval(signal,()=>this.ports.reviewKey(remember)))throw new FinderSearchError(FINDER_ERRORS.cancel);this.fresh(token);
  // Configuration only: do not spend quota or claim API access has been verified.
  if(remember)await this.ports.vault.write(key);else await this.ports.vault.clear();this.fresh(token);this.key=key;this.pageState=undefined;this.known.clear();await this.ports.clearClipboard(key).catch(()=>{});this.fresh(token);return this.status();
 });}
 restore(){return this.operation(async(_signal,token)=>{const key=await this.ports.vault.read();this.fresh(token);if(!key)throw new FinderSearchError(FINDER_ERRORS.key);this.key=key;this.pageState=undefined;this.known.clear();return this.status();});}
 disconnect(){return this.operation(async(_signal,token)=>{await this.ports.vault.clear();this.fresh(token);this.key=undefined;this.pageState=undefined;this.known.clear();return this.status();});}
 search(input:unknown){return this.operation(async(signal,token):Promise<FinderSearchPage>=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new FinderSearchError(FINDER_ERRORS.invalid);const v=input as Record<string,unknown>,expected=v.cursor===undefined?['conditions','consent']:['conditions','consent','cursor'];if(Object.keys(v).sort().join(',')!==expected.sort().join(',')||v.consent!==true)throw new FinderSearchError('검색어 외부 전송에 먼저 동의해 주세요.');
  const conditions=validateFinderConditions(v.conditions),fingerprint=JSON.stringify(conditions);if(!this.key)throw new FinderSearchError(FINDER_ERRORS.key);const key=this.key;
  const previous=this.pageState;let page=1,pageToken:string|undefined,seen=new Set<string>();
  if(v.cursor!==undefined){if(typeof v.cursor!=='string'||!previous||previous.cursor!==v.cursor||previous.fingerprint!==fingerprint||previous.page>=3)throw new FinderSearchError('추가 검색이 만료됐습니다. 조건을 확인하고 새로 검색해 주세요.');page=previous.page+1;pageToken=previous.token;seen=new Set(previous.seen);}
  if(!await waitForApproval(signal,()=>this.ports.reviewSearch(conditions.topic+' '+conditions.target,page)))throw new FinderSearchError(FINDER_ERRORS.cancel);this.fresh(token);let timedOut=false;const timer=setTimeout(()=>{timedOut=true;this.controller?.abort();},this.ports.timeoutMs??15000);
  try{const result=await searchYoutube(this.ports.fetch,key,conditions,signal,pageToken);this.fresh(token);const videos=result.videos.filter(v=>!seen.has(v.videoId));for(const video of result.videos)seen.add(video.videoId);
   const nextCursor=page<3&&result.nextToken&&result.nextToken!==pageToken?randomUUID():null;this.pageState=nextCursor?{fingerprint,page,cursor:nextCursor,token:result.nextToken!,seen}:undefined;
   for(const video of videos)this.known.set(video.videoId,video);while(this.known.size>100)this.known.delete(this.known.keys().next().value!);return {videos,nextCursor,page,omitted:result.omitted};
  }catch(e){if(token!==this.generation)throw new FinderSearchError(FINDER_ERRORS.cancel);if(timedOut)throw new FinderSearchError(FINDER_ERRORS.timeout);if(signal.aborted)throw new FinderSearchError(FINDER_ERRORS.cancel);throw e;}finally{clearTimeout(timer);}
 });}
 openVideo(input:unknown){return this.operation(async(_signal,token)=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).join(',')!=='videoId'||!validVideoId((input as {videoId:unknown}).videoId))throw new FinderSearchError(FINDER_ERRORS.invalid);const id=(input as {videoId:string}).videoId;
  const saved=this.known.has(id)?undefined:(await this.ports.library()).items.find(item=>item.source==='youtube'&&item.videoId===id);this.fresh(token);if(!this.known.has(id)&&!saved)throw new FinderSearchError('실제 검색 결과 또는 저장한 실제 영상에서 원본 열기를 선택해 주세요.');await this.ports.openExternal(`https://www.youtube.com/watch?v=${id}`);this.fresh(token);return null;
 });}
 cancel(){this.generation++;this.controller?.abort();this.pageState=undefined;return null;}
 dispose(){this.cancel();this.disposed=true;this.key=undefined;this.known.clear();}
 async flush(){await Promise.allSettled([...this.pending]);}
}
export function createFinderSearchHandlers(contents:Parameters<typeof assertSender>[1],url:string,service:FinderSearchService){
 const run=(count:number,task:(args:unknown[])=>Promise<unknown>|null)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<unknown>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 Finder 요청입니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:FINDER_ERRORS.invalid,retryable:false}};
  try{return {ok:true,data:await task(args)};}catch(e){return {ok:false,error:{code:'INTERNAL_ERROR',message:e instanceof FinderSearchError?e.message:'Finder 검색·연결 작업을 완료하지 못했습니다. 기존 보관함은 유지됩니다.',retryable:false}};}
 };
 return {status:run(0,()=>service.status()),connectFromClipboard:run(1,args=>service.connect(args[0])),restore:run(0,()=>service.restore()),disconnect:run(0,()=>service.disconnect()),search:run(1,args=>service.search(args[0])),cancel:run(0,()=>service.cancel()),openVideo:run(1,args=>service.openVideo(args[0]))};
}
