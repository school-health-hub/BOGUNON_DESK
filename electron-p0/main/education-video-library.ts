import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
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

export class EducationVideoLibraryStore{
 private queue:Promise<void>=Promise.resolve();
 constructor(private readonly root:string){}
 private path(name='library.json'){return join(this.root,name);}
 private async readNamed(name:string):Promise<EducationVideoLibrary>{
  const bytes=await readFile(this.path(name));if(bytes.length>MAX_BYTES)throw Error('Oversized education video library');
  return validateEducationVideoLibrary(JSON.parse(bytes.toString('utf8')));
 }
 async load():Promise<{library:EducationVideoLibrary;recovered:boolean}>{
  try{return {library:await this.readNamed('library.json'),recovered:false};}
  catch(error){
   if((error as NodeJS.ErrnoException).code==='ENOENT')return {library:{version:1,items:[]},recovered:false};
   try{return {library:await this.readNamed('library.backup.json'),recovered:true};}
   catch{throw Error('Education video library could not be read; original files preserved');}
  }
 }
 private writeFile(name:string,library:EducationVideoLibrary):Promise<void>{
  const operation=this.queue.then(async()=>{
   await mkdir(this.root,{recursive:true,mode:0o700});const temp=this.path(`${name}-${randomUUID()}.tmp`);
   try{const file=await open(temp,'wx',0o600);try{await file.writeFile(JSON.stringify(library));await file.sync();}finally{await file.close();}await rename(temp,this.path(name));}
   catch{await unlink(temp).catch(()=>{});throw Error('Education video library was not saved');}
  });this.queue=operation.catch(()=>{});return operation;
 }
 async write(library:unknown):Promise<{library:EducationVideoLibrary;recovered:boolean}>{
  const safe=validateEducationVideoLibrary(library);const current=await this.load();
  if(current.library.items.length)await this.writeFile('library.backup.json',current.library);
  await this.writeFile('library.json',safe);return {library:safe,recovered:false};
 }
 async save(item:unknown){const safeItem=validateEducationVideoLibrary({version:1,items:[item]}).items[0];const current=await this.load();return this.write({version:1,items:[...current.library.items.filter(row=>row.videoId!==safeItem.videoId),safeItem]});}
 async import(json:unknown){if(typeof json!=='string'||Buffer.byteLength(json)>MAX_BYTES)throw Error('Invalid education video import');const incoming=validateEducationVideoLibrary(JSON.parse(json));const current=await this.load();return this.write({version:1,items:[...current.library.items,...incoming.items.filter(item=>!current.library.items.some(row=>row.videoId===item.videoId))]});}
 async export(){return JSON.stringify((await this.load()).library,null,2);}
 async recover(){const library=await this.readNamed('library.backup.json');await this.writeFile('library.json',library);return {library,recovered:true};}
 flush(){return this.queue;}
}

type Event={sender:unknown;senderFrame:unknown};
const ok=<T>(data:T):IpcResult<T>=>({ok:true,data});
const failure=(code:'FORBIDDEN'|'INVALID_INPUT'|'STORAGE_ERROR',message:string):IpcResult<never>=>({ok:false,error:{code,message,retryable:code==='STORAGE_ERROR'}});
export function createEducationVideoHandlers(webContents:unknown,url:string,store:EducationVideoLibraryStore){
 const allowed=(event:Event)=>{try{assertSender(event as never,webContents as never,url);return true;}catch{return false;}};
 const run=async<T>(event:Event,args:unknown[],action:()=>Promise<T>):Promise<IpcResult<T>>=>{if(!allowed(event))return failure('FORBIDDEN','허용되지 않은 요청입니다.');try{if(args.length)throw Error('INVALID_INPUT');return ok(await action());}catch(error){return failure(error instanceof Error&&error.message==='INVALID_INPUT'?'INVALID_INPUT':'STORAGE_ERROR','교육영상 라이브러리 작업을 완료하지 못했습니다. 기존 파일은 유지됩니다.');}};
 return {
  load:(event:Event,...args:unknown[])=>run(event,args,()=>store.load()),
  save:(event:Event,item:unknown,...args:unknown[])=>run(event,args,()=>store.save(item)),
  import:(event:Event,json:unknown,...args:unknown[])=>run(event,args,()=>store.import(json)),
  export:(event:Event,...args:unknown[])=>run(event,args,()=>store.export()),
  recover:(event:Event,...args:unknown[])=>run(event,args,()=>store.recover()),
 };
}
