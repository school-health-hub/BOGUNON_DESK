import {constants} from 'node:fs';
import {lstat,open,unlink} from 'node:fs/promises';
import {dirname,join,parse} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {SettingsStore} from './settings.js';
import type {LibraryV2,V2Load,FinderV2Edit} from '../finder-v2-protocol.js';
import {validateLibraryV2,validateTeacher,fields as assertFields} from './finder-v2/validate.js';
import {parseAiMetadata} from './finder-v2/aiLibraryMetadata.js';
import {applyCandidateRecord,parseCandidateRecord} from './finder-v2/candidateRecord.js';
import {parseRecommendationReason} from './finder-v2/recommendationReason.js';
import type {EducationVideoLibrary,EducationVideoLibraryItem,IpcResult} from '../protocol.js';
import {assertSender} from './policy.js';

const MAX_BYTES=2*1024*1024;
const fields=['videoId','title','channelId','channelTitle','durationSeconds','url','source','educationTitle','target','schedule','instructions','message','notes'] as const;
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const safeText=(value:unknown,max=20000):value is string=>typeof value==='string'&&value.length<=max&&!value.includes('\0');

export function validateEducationVideoLibrary(value:unknown):EducationVideoLibrary{
 if(!record(value)||Object.keys(value).some(key=>key!=='version'&&key!=='items')||value.version!==1||!Array.isArray(value.items)||value.items.length>1000)throw Error('Invalid education video library');
 const seen=new Set<string>();
 const items=value.items.map((item:unknown):EducationVideoLibraryItem=>{
  if(!record(item)||Object.keys(item).some(key=>!fields.includes(key as typeof fields[number]))||fields.some(key=>!(key in item)))throw Error('Invalid education video item');
  if(typeof item.videoId!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(item.videoId)||seen.has(item.videoId)||(item.source!=='mock'&&item.source!=='youtube')||typeof item.durationSeconds!=='number'||!Number.isInteger(item.durationSeconds)||item.durationSeconds<1||item.durationSeconds>86400)throw Error('Invalid education video item');
  for(const key of fields)if(key!=='durationSeconds'&&key!=='source'&&!safeText(item[key],key==='url'?200:20000))throw Error('Invalid education video item');
  const url=new URL(String(item.url));
  if(url.protocol!=='https:'||url.hostname!=='www.youtube.com'||url.pathname!=='/watch'||url.hash||url.username||url.password||url.port||url.searchParams.toString()!==`v=${item.videoId}`)throw Error('Invalid education video URL');
  seen.add(item.videoId);
  return structuredClone(item) as EducationVideoLibraryItem;
 });
 const library={version:1 as const,items};
 if(Buffer.byteLength(JSON.stringify(library))>MAX_BYTES)throw Error('Oversized education video library');
 return library;
}

export class FinderLibraryConflict extends Error{}
class FinderRecoveryError extends Error{}
const emptyV1:EducationVideoLibrary={version:1,items:[]};

async function readRecoveryCandidate(path:string) {
 let bytes:Buffer;
 try {
  const stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>MAX_BYTES)throw new FinderRecoveryError('Unsafe Finder recovery file');
  const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try {
   const start=await file.stat();
   if(!start.isFile()||start.nlink!==1||start.dev!==stat.dev||start.ino!==stat.ino||start.size!==stat.size||start.mtimeMs!==stat.mtimeMs||start.ctimeMs!==stat.ctimeMs) {
    throw new FinderRecoveryError('Finder recovery file changed before read');
   }
   const buffer=Buffer.alloc(start.size+1);
   let offset=0;
   while(offset<buffer.length) {
    const {bytesRead}=await file.read(buffer,offset,buffer.length-offset,offset);
    if(!bytesRead)break;
    offset+=bytesRead;
   }
   const end=await file.stat();
   if(offset!==start.size||end.size!==start.size||end.mtimeMs!==start.mtimeMs||end.ctimeMs!==start.ctimeMs)throw new FinderRecoveryError('Finder recovery file changed during read');
   bytes=buffer.subarray(0,offset);
  } finally {await file.close();}
 } catch(error) {
  if(error instanceof Error&&'code' in error&&error.code==='ENOENT')return {kind:'missing'} as const;
  throw error;
 }
 let value:unknown;
 try {value=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));}
 catch(error) {
  if(error instanceof SyntaxError||error instanceof TypeError)return {kind:'corrupt',bytes} as const;
  throw error;
 }
 if(record(value)&&'version' in value&&value.version!==1)throw new FinderRecoveryError('Unsupported Finder recovery version');
 try {return {kind:'valid',library:validateEducationVideoLibrary(value)} as const;}
 catch(error) {
  if(error instanceof Error)return {kind:'corrupt',bytes} as const;
  throw error;
 }
}

async function quarantine(root:string,bytes:Buffer) {
 const path=join(root,`library.corrupt-${randomUUID()}.json`);
 const file=await open(path,'wx',0o600);
 try {
  try {await file.writeFile(bytes);await file.sync();}
  finally {await file.close();}
 } catch(error) {
  await unlink(path);
  throw error;
 }
}

export class EducationVideoLibraryStore{
 private queue:Promise<void>=Promise.resolve();
 private v1:SettingsStore<EducationVideoLibrary>;
 private v1Backup:SettingsStore<EducationVideoLibrary>;
 private v2:SettingsStore<LibraryV2>;
 private v2Backup:SettingsStore<LibraryV2>;
 constructor(private readonly root:string,private readonly writePrimary?:(name:string,value:EducationVideoLibrary|LibraryV2)=>Promise<void>){
  this.v1=new SettingsStore(root,'library.json',validateEducationVideoLibrary,MAX_BYTES);
  this.v1Backup=new SettingsStore(root,'library.backup.json',validateEducationVideoLibrary,MAX_BYTES);
  this.v2=new SettingsStore(root,'library-v2.json',validateLibraryV2,MAX_BYTES);
  this.v2Backup=new SettingsStore(root,'library-v2.backup.json',validateLibraryV2,MAX_BYTES);
 }
 private async safe(){
  for(let p=this.root;p!==parse(p).root;p=dirname(p)){try{const x=await lstat(p);if(x.isSymbolicLink()||!x.isDirectory())throw Error('Unsafe Finder folder');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  for(const name of ['library.json','library.backup.json','library-v2.json','library-v2.backup.json']){try{const x=await lstat(join(this.root,name));if(x.isSymbolicLink()||!x.isFile()||x.nlink!==1)throw Error('Unsafe Finder file');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 }
 private async read<T>(primary:SettingsStore<T>,backup:SettingsStore<T>,empty:T):Promise<{library:T;recovered:boolean}>{
  await this.safe();
  try{const library=await primary.read();if(library)return {library,recovered:false};const fallback=await backup.read();return fallback?{library:fallback,recovered:true}:{library:empty,recovered:false};}
  catch{const library=await backup.read();if(library)return {library,recovered:true};throw Error('Finder original files unreadable; preserved');}
 }
 private readV1(){return this.read(this.v1,this.v1Backup,emptyV1);}
 load(){return this.mutate(async()=>{
  await this.safe();
  const primaryPath=join(this.root,'library.json');
  const primary=await readRecoveryCandidate(primaryPath);
  if(primary.kind==='valid')return {library:primary.library,recovered:false};
  const backup=await readRecoveryCandidate(join(this.root,'library.backup.json'));
  if(primary.kind==='missing'&&backup.kind==='missing')return {library:emptyV1,recovered:false};
  if(backup.kind!=='valid')throw new FinderRecoveryError('No valid Finder backup; originals preserved');
  // Keep the original at its path until the quarantine is durable and replacement succeeds.
  if(primary.kind==='corrupt')await quarantine(this.root,primary.bytes);
  const current=await readRecoveryCandidate(primaryPath);
  const unchanged=primary.kind==='corrupt'
   ?current.kind==='corrupt'&&primary.bytes.equals(current.bytes)
   :current.kind==='missing';
  if(!unchanged)throw new FinderRecoveryError('Finder primary changed during recovery');
  await (this.writePrimary?this.writePrimary('library.json',backup.library):this.v1.write(backup.library));
  return {library:backup.library,recovered:true};
 });}
 async readLibrary(){return (await this.readV1()).library;}
 private readV2(){return this.read(this.v2,this.v2Backup,{version:2,entries:[]});}
 async snapshot(){
  const [v1,v2]=await Promise.all([this.readV1(),this.readV2()]);
  const fingerprint=createHash('sha256').update(JSON.stringify([v1.library,v2.library])).digest('hex');
  return {v1,v2,fingerprint};
 }
 async loadV2():Promise<V2Load>{const s=await this.snapshot();return {...s.v2,fingerprint:s.fingerprint};}
 private mutate<T>(action:()=>Promise<T>):Promise<T>{const job=this.queue.then(action);this.queue=job.then(()=>{},()=>{});return job;}
 private writable(s:Awaited<ReturnType<EducationVideoLibraryStore['snapshot']>>){if(s.v1.recovered||s.v2.recovered)throw Error('Recovered Finder backup is read only');}
 private async commitV1(value:EducationVideoLibrary,previous:EducationVideoLibrary,fresh=()=>{}){
  const safe=validateEducationVideoLibrary(value);if(previous.items.length)await this.v1Backup.write(previous);
  fresh();await (this.writePrimary?this.writePrimary('library.json',safe):this.v1.write(safe));return {library:safe,recovered:false};
 }
 private async commitV2(value:LibraryV2,previous:LibraryV2,fresh=()=>{}){
  const safe=validateLibraryV2(value);if(previous.entries.length)await this.v2Backup.write(previous);
  fresh();await (this.writePrimary?this.writePrimary('library-v2.json',safe):this.v2.write(safe));return this.loadV2();
 }
 async write(value:unknown){const safe=validateEducationVideoLibrary(value);return this.mutate(async()=>{const s=await this.snapshot();this.writable(s);if(safe.items.some(i=>s.v2.library.entries.some(e=>e.videoId===i.videoId)))throw new FinderLibraryConflict();return this.commitV1(safe,s.v1.library);});}
 async save(value:unknown){const item=validateEducationVideoLibrary({version:1,items:[value]}).items[0];return this.mutate(async()=>{const s=await this.snapshot();this.writable(s);if(s.v2.library.entries.some(e=>e.videoId===item.videoId))throw new FinderLibraryConflict('V2 data preserved');return this.commitV1({version:1,items:[...s.v1.library.items.filter(e=>e.videoId!==item.videoId),item]},s.v1.library);});}
 async import(json:unknown){
  if(typeof json!=='string'||Buffer.byteLength(json)>MAX_BYTES)throw Error('Invalid import');const incoming=validateEducationVideoLibrary(JSON.parse(json));
  return this.mutate(async()=>{const s=await this.snapshot();this.writable(s);const ids=new Set([...s.v1.library.items,...s.v2.library.entries].map(e=>e.videoId));return this.commitV1({version:1,items:[...s.v1.library.items,...incoming.items.filter(e=>!ids.has(e.videoId))]},s.v1.library);});
 }
 async importReviewed(incoming:EducationVideoLibrary|LibraryV2,selectedIds:readonly string[],expected:string,fresh=()=>{}){
  const safe=incoming.version===1?validateEducationVideoLibrary(incoming):validateLibraryV2(incoming);
  return this.mutate(async()=>{fresh();const s=await this.snapshot();this.writable(s);fresh();if(s.fingerprint!==expected)throw new FinderLibraryConflict();
   const rows=safe.version===1?safe.items:safe.entries,chosen=new Set(selectedIds),existing=new Set([...s.v1.library.items,...s.v2.library.entries].map(e=>e.videoId));
   if(!chosen.size||chosen.size!==selectedIds.length||selectedIds.some(id=>existing.has(id)||!rows.some(e=>e.videoId===id)))throw new FinderLibraryConflict();
   if(safe.version===1)await this.commitV1({version:1,items:[...s.v1.library.items,...safe.items.filter(e=>chosen.has(e.videoId))]},s.v1.library,fresh);
   else await this.commitV2({version:2,entries:[...s.v2.library.entries,...safe.entries.filter(e=>chosen.has(e.videoId))]},s.v2.library,fresh);
   return {added:chosen.size,skipped:rows.length-chosen.size,v1:await this.readLibrary(),v2:await this.loadV2()};
  });
 }
 async editV2(value:unknown):Promise<V2Load>{
  assertFields(value,['videoId','expectedFingerprint','teacher'],['candidateRecord','recommendationReason']);const request=structuredClone(value) as FinderV2Edit;validateTeacher(request.teacher);
  return this.mutate(async()=>{const s=await this.snapshot();this.writable(s);if(s.fingerprint!==request.expectedFingerprint)throw new FinderLibraryConflict();const entry=s.v2.library.entries.find(e=>e.videoId===request.videoId);if(!entry)throw new FinderLibraryConflict();
   let next={...entry,teacher:request.teacher};
   if(request.candidateRecord!==undefined){const record=parseCandidateRecord({...request.candidateRecord,savedAt:new Date().toISOString()});next={...next,candidateRecord:record,...(entry.ai?{ai:applyCandidateRecord(parseAiMetadata(entry.ai,entry.videoId,Date.now()),record)}:{})};}
   if(request.recommendationReason!==undefined)next={...next,recommendationReason:parseRecommendationReason(request.recommendationReason)};
   return this.commitV2({version:2,entries:s.v2.library.entries.map(e=>e.videoId===next.videoId?next:e)},s.v2.library);
  });
 }
 async export(){return JSON.stringify(await this.readLibrary(),null,2);}
 async exportV2(){return JSON.stringify((await this.loadV2()).library);}
 recover(){return this.load();}
 flush(){return this.queue;}
}

type Event={sender:unknown;senderFrame:unknown};
const ok=<T>(data:T):IpcResult<T>=>({ok:true,data});
const failure=(code:'FORBIDDEN'|'INVALID_INPUT'|'STORAGE_ERROR'|'CONFLICT',message:string):IpcResult<never>=>({ok:false,error:{code,message,retryable:code==='STORAGE_ERROR'}});
export function createEducationVideoHandlers(webContents:unknown,url:string,store:EducationVideoLibraryStore){
 const allowed=(event:Event)=>{try{assertSender(event as never,webContents as never,url);return true;}catch{return false;}};
 const run=async<T>(event:Event,args:unknown[],action:()=>Promise<T>):Promise<IpcResult<T>>=>{if(!allowed(event))return failure('FORBIDDEN','허용되지 않은 요청입니다.');try{if(args.length)throw Error('INVALID_INPUT');return ok(await action());}catch(error){return failure(error instanceof FinderLibraryConflict?'CONFLICT':error instanceof Error&&error.message==='INVALID_INPUT'?'INVALID_INPUT':'STORAGE_ERROR',error instanceof FinderLibraryConflict?'기존 V2 자료 또는 보관함 변경을 확인해 주세요. V2 편집에서 수정할 수 있으며 기존 자료는 유지했습니다.':'교육영상 라이브러리 작업을 완료하지 못했습니다. 기존 파일은 유지됩니다.');}};
 return {
  load:(event:Event,...args:unknown[])=>run(event,args,()=>store.load()),
  save:(event:Event,item:unknown,...args:unknown[])=>run(event,args,()=>store.save(item)),
  import:(event:Event,json:unknown,...args:unknown[])=>run(event,args,()=>store.import(json)),
  export:(event:Event,...args:unknown[])=>run(event,args,()=>store.export()),
  recover:(event:Event,...args:unknown[])=>run(event,args,()=>store.recover()),
 };
}
