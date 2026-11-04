import {constants} from 'node:fs';
import {lstat,open} from 'node:fs/promises';
import {extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {EducationVideoLibrary,IpcResult} from '../protocol.js';
import type {LibraryV2,FinderImportPreview,FinderImportApply} from '../finder-v2-protocol.js';
import {EducationVideoLibraryStore,FinderLibraryConflict,validateEducationVideoLibrary} from './education-video-library.js';
import {FINDER_BYTES,FinderFormatError,fields,validateLibraryV2,entryTitle} from './finder-v2/validate.js';
import {assertSender} from './policy.js';

export async function readSelectedFinderJson(path:string):Promise<string>{
 if(extname(path).toLowerCase()!=='.json')throw new FinderFormatError('JSON 파일만 선택해 주세요.');
 const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||!before.size||before.size>FINDER_BYTES)throw new FinderFormatError('일반 JSON 파일·2 MiB 제한을 확인해 주세요.');
 const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{
  const start=await file.stat();if(start.ino!==before.ino||start.dev!==before.dev||!start.isFile()||start.size!==before.size)throw Error('Selected file changed');
  const bytes=Buffer.alloc(start.size+1);let offset=0;
  while(offset<bytes.length){const {bytesRead}=await file.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)break;offset+=bytesRead;}
  const end=await file.stat();if(offset!==start.size||end.size!==start.size||end.mtimeMs!==start.mtimeMs||end.ctimeMs!==start.ctimeMs)throw Error('Selected file changed');
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,offset));
 }finally{await file.close();}
}
export function parseFinderImport(json:string):EducationVideoLibrary|LibraryV2{
 if(Buffer.byteLength(json)>FINDER_BYTES)throw new FinderFormatError('Finder JSON은 2 MiB 이하여야 합니다.');
 let value:unknown;try{value=JSON.parse(json);}catch{throw new FinderFormatError('손상된 JSON입니다. 기존 자료는 유지합니다.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new FinderFormatError('Finder JSON 객체가 필요합니다.');
 const version=(value as {version?:unknown}).version;
 if(version===2){try{return validateLibraryV2(value);}catch(e){if(e instanceof FinderFormatError)throw e;throw new FinderFormatError('V2 AI·교사 확인 기록이 불완전하거나 지원하지 않는 필드를 포함합니다. 손실 없는 적용을 차단했습니다.');}}
 if(version===1){try{return validateEducationVideoLibrary(value);}catch{throw new FinderFormatError('V1 스키마·미지원 필드·중복 ID를 확인해 주세요. 손실 없는 적용을 차단했습니다.');}}
 throw new FinderFormatError('지원하지 않는 Finder JSON 버전입니다. 기존 자료는 변경하지 않았습니다.');
}
export function createFinderCompatHandlers(contents:Parameters<typeof assertSender>[1],url:string,store:EducationVideoLibraryStore,ports:{pick:()=>Promise<string|undefined>;read?:(path:string)=>Promise<string>;now?:()=>number}){
 let generation=0,disposed=false,picking=false,applying=false;
 let prepared:{token:string;library:EducationVideoLibrary|LibraryV2;fingerprint:string;created:number}|undefined;
 const stop=new AbortController(),now=ports.now??Date.now;
 const fresh=(event:Parameters<typeof assertSender>[0])=>{assertSender(event,contents,url);if(disposed)throw Error('Closed Finder');};
 const wait=<T>(operation:Promise<T>)=>new Promise<T>((resolve,reject)=>{
  const cancel=()=>reject(Error('Closed Finder'));if(stop.signal.aborted)return cancel();stop.signal.addEventListener('abort',cancel,{once:true});
  operation.then(v=>{stop.signal.removeEventListener('abort',cancel);resolve(v);},e=>{stop.signal.removeEventListener('abort',cancel);reject(e);});
 });
 const run=<T>(count:number,action:(args:unknown[],event:Parameters<typeof assertSender>[0])=>Promise<T>)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<T>>=>{
  try{fresh(event);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 Finder 요청입니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:'Finder 요청에는 파일 경로나 추가 인수를 전달할 수 없습니다.',retryable:false}};
  try{return {ok:true,data:await action(args,event)};}catch(e){return {ok:false,error:{code:e instanceof FinderFormatError?'INVALID_INPUT':e instanceof FinderLibraryConflict?'CONFLICT':'STORAGE_ERROR',message:e instanceof FinderFormatError?e.message:e instanceof FinderLibraryConflict?'보관함 또는 가져오기 상태가 변경됐습니다. 기존 자료를 유지했습니다. 다시 선택·확인해 주세요.':'Finder 작업을 완료하지 못했습니다. 기존 파일·메모·안내문을 유지합니다.',retryable:!(e instanceof FinderFormatError)}};}
 };
 return {
  loadV2:run(0,()=>store.loadV2()),
  prepareImport:run(0,async(_args,event)=>{
   if(picking||applying)throw new FinderLibraryConflict();picking=true;prepared=undefined;const epoch=++generation;
   try{
    const path=await wait(ports.pick());if(disposed||epoch!==generation||!path)return null;fresh(event);
    const json=await wait((ports.read??readSelectedFinderJson)(path));if(disposed||epoch!==generation)return null;fresh(event);
    const library=parseFinderImport(json),state=await store.snapshot();fresh(event);if(epoch!==generation)return null;
    if(state.v1.recovered||state.v2.recovered)throw Error('Read-only backup');
    const ids=new Set([...state.v1.library.items,...state.v2.library.entries].map(e=>e.videoId));
    const rows=library.version===1?library.items.map(e=>({videoId:e.videoId,title:e.educationTitle||e.title,conflict:ids.has(e.videoId),hasAi:false,expiredMetadata:false})):library.entries.map(e=>({videoId:e.videoId,title:entryTitle(e),conflict:ids.has(e.videoId),hasAi:!!(e.ai||e.candidateRecord||e.recommendationReason),expiredMetadata:!!e.provider&&Date.parse(e.provider.expiresAt)<=now()}));
    const token=randomUUID();prepared={token,library,fingerprint:state.fingerprint,created:now()};
    const preview:FinderImportPreview={token,version:library.version,total:rows.length,rows,warnings:library.version===2?['V2 원본 필드를 별도 저장합니다. V1 JSON에는 포함되지 않으며 V2 내보내기로 보존됩니다.','가져온 공식·AI 확인 표시는 원본 기록이며 앱이 재검증한 사실이 아닙니다. 만료 메타데이터도 자동 삭제하지 않습니다.']:[]};return preview;
   }catch(e){if(disposed||epoch!==generation)return null;throw e;}finally{picking=false;}
  }),
  applyImport:run(1,async(args,event)=>{
   fields(args[0],['token','selectedIds']);const r=args[0] as FinderImportApply;
   if(applying||!prepared||prepared.token!==r.token||now()-prepared.created>10*60*1000||!Array.isArray(r.selectedIds)||r.selectedIds.length>1000||r.selectedIds.some(id=>typeof id!=='string'))throw new FinderLibraryConflict();
   const p=prepared;applying=true;
   try{fresh(event);const result=await store.importReviewed(p.library,r.selectedIds,p.fingerprint,()=>{fresh(event);if(prepared!==p)throw new FinderLibraryConflict();});prepared=undefined;return result;}finally{applying=false;}
  }),
  discardImport:run(0,async()=>{if(applying)throw new FinderLibraryConflict();generation++;prepared=undefined;return null;}),
  editV2:run(1,args=>store.editV2(args[0])),
  dispose:()=>{disposed=true;generation++;prepared=undefined;stop.abort();},flush:()=>store.flush(),
 };
}
