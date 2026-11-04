import {mkdir,mkdtemp,writeFile,rm,lstat} from 'node:fs/promises';import {join,dirname,parse} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import type {IpcResult,OfficialDocumentImported,PurchaseCsvSelection} from '../protocol.js';
import type {RecordImportBatch} from '../record-helper-protocol.js';import type {ImageSelection} from '../purchase-image-protocol.js';
import type {DropOffer,DropDelivery,DropTarget,DropFile} from '../file-drop-protocol.js';
import {assertSender} from './policy.js';import {probeDropFile,sameStamp,type DropStamp} from './file-drop-files.js';import {buildFileDropRouteModel} from './file-drop-router.js';import {readSelectedPurchaseFile} from './purchase-import.js';
type Event=Parameters<typeof assertSender>[0];
type Selected={path:string;meta:DropFile;stamp:DropStamp;snapshot?:string;hash?:string;taken?:boolean};
type Session={offer:DropOffer;selected:Selected[];approved?:DropTarget;root?:string;timer:ReturnType<typeof setTimeout>};
export type DropPorts={official:(event:Event)=>Promise<IpcResult<OfficialDocumentImported|null>>;record:(event:Event)=>Promise<IpcResult<RecordImportBatch|null>>;purchase:(kind:'csv'|'excel'|'pdf',event:Event)=>Promise<IpcResult<PurchaseCsvSelection|null>>;images:(event:Event)=>Promise<IpcResult<ImageSelection|null>>;cancelImport:(kind:string)=>void};
/** Private picker adapter: no renderer channel can set paths or choose a native executable. */
export class DropSelections{
 private slot:{kind:string;paths:readonly string[]}|null=null;
 take(kind:string){if(this.slot?.kind!==kind)return undefined;const paths=this.slot.paths;this.slot=null;return paths;}
 async withPaths<T>(kind:string,paths:readonly string[],run:()=>Promise<T>):Promise<T>{if(this.slot)throw Error('Busy drop selector');this.slot={kind,paths};try{return await run();}finally{this.slot=null;}}
}
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function createFileDropHandlers(contents:Parameters<typeof assertSender>[1],url:string,root:string,selections:DropSelections,ports:DropPorts,publish:(r:IpcResult<DropOffer>)=>void,options:{ttl?:number;approvedTtl?:number}={}){
 let session:Session|null=null,disposed=false,busy=false,epoch=0,activeKind:string|null=null;const pending=new Set<Promise<unknown>>();
 const track=<T>(task:Promise<T>)=>{pending.add(task);void task.finally(()=>pending.delete(task)).catch(()=>{});return task;};
 const fresh=(event:Event,generation=epoch)=>{assertSender(event,contents,url);if(disposed||generation!==epoch)throw Error('Stale drop');};
 const error=():IpcResult<never>=>({ok:false,error:{code:'INVALID_INPUT',message:'드롭 파일을 사용할 수 없습니다. 로컬 일반 파일·실제 형식·개수·크기·변경 여부를 확인하고 다시 드롭해 주세요. 기존 작업은 유지합니다.',retryable:true}});
 const remove=(s:Session|null)=>{if(s){clearTimeout(s.timer);if(s.root)track(rm(s.root,{recursive:true,force:true,maxRetries:3,retryDelay:100}));}};
 const clear=()=>{epoch++;if(activeKind)try{ports.cancelImport(activeKind);}catch{}const old=session;session=null;remove(old);};
 const arm=(s:Session,ms:number)=>{clearTimeout(s.timer);s.timer=setTimeout(()=>{if(session===s)clear();},ms);s.timer.unref?.();};
 const run=<T>(count:number,fn:(args:unknown[],event:Event)=>Promise<T>)=>async(event:Event,...args:unknown[]):Promise<IpcResult<T>>=>{
  try{fresh(event);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 파일 드롭 요청입니다.',retryable:false}};}
  if(args.length!==count)return error();try{return {ok:true,data:await track(fn(args,event))};}catch{return error();}
 };
 const get=(request:unknown,target?:DropTarget,source=false)=>{if(!exact(request,source?['token','sourceId']:['token'])||!session||request.token!==session.offer.token||(target&&session.approved!==target))throw Error('Invalid drop token');return session;};
 const consume=async<T>(request:unknown,event:Event,target:DropTarget,kind:string,importer:()=>Promise<IpcResult<T>>,source=false)=>{
  if(busy)throw Error('Busy');const s=get(request,target,source),r=request as {sourceId?:string};
  const files=source?s.selected.filter(f=>f.meta.id===r.sourceId):kind==='images'?s.selected.filter(f=>['png','jpg','jpeg'].includes(f.meta.kind)):s.selected;
  if(!files.length||files.some(f=>f.taken||!f.snapshot)||kind==='official'&&files.length!==1||source&&files.length!==1)throw Error('Invalid selection');
  if(kind==='images'&&(files.length>10||files.some(f=>!['png','jpg','jpeg'].includes(f.meta.kind))))throw Error();
  busy=true;activeKind=kind;const generation=epoch;
  try{
   for(const f of files){const p=await probeDropFile(f.snapshot!);if(p.name!==f.meta.name||p.kind!==f.meta.kind||createHash('sha256').update(await readSelectedPurchaseFile(f.snapshot!,[`.${f.meta.kind}`])).digest('hex')!==f.hash)throw Error('Changed snapshot');}fresh(event,generation);
   files.forEach(f=>{f.taken=true;});const reply=await selections.withPaths(kind,files.map(f=>f.snapshot!),importer);fresh(event,generation);
   for(const f of files)if(createHash('sha256').update(await readSelectedPurchaseFile(f.snapshot!,[`.${f.meta.kind}`])).digest('hex')!==f.hash)throw Error('Changed snapshot');
   if(!reply.ok)throw Error('Import failed');return reply.data;
  }catch(e){try{ports.cancelImport(kind);}catch{}throw e;}finally{
   activeKind=null;busy=false;
   for(const f of files){if(f.taken&&f.snapshot){track(rm(dirname(f.snapshot),{recursive:true,force:true}));f.snapshot=undefined;}}
   if(session===s&&s.selected.every(f=>f.taken)){session=null;remove(s);}
  }
 };
 const handlers={
  // This channel is private to isolated preload trusted native File drop capture.
  stage:run(1,async(args,event):Promise<DropOffer>=>{
   if(busy||!Array.isArray(args[0])||!args[0].length||args[0].length>50||args[0].some(p=>typeof p!=='string')||new Set(args[0]).size!==args[0].length)throw Error();
   busy=true;const generation=epoch;try{
    const selected:Selected[]=[];let bytes=0;for(const path of args[0] as string[]){const f=await probeDropFile(path);fresh(event,generation);bytes+=f.stamp.size;if(bytes>150*1024*1024)throw Error();selected.push({path,meta:{id:randomUUID(),name:f.name,kind:f.kind,bytes:f.stamp.size},stamp:f.stamp});}
    if(session){if(!session.approved&&selected.length===session.selected.length&&selected.every((f,i)=>f.path===session!.selected[i].path&&sameStamp(f.stamp,session!.selected[i].stamp)))return session.offer;throw Error('Another drop pending');}
    const candidates=buildFileDropRouteModel(selected.map(f=>f.meta.name)).candidates.map(c=>({...c,enabled:c.enabled&&(c.target!=='purchase-helper'||selected.filter(f=>['png','jpg','jpeg'].includes(f.meta.kind)).length<=10)}));if(!candidates.some(c=>c.enabled))throw Error();
    const offer:DropOffer={token:randomUUID(),files:selected.map(f=>f.meta),candidates};const s:Session={offer,selected,timer:setTimeout(()=>{},0)};session=s;arm(s,options.ttl??120000);return offer;
   }finally{busy=false;}
  }),
  status:run(0,async()=>session&&!session.approved?session.offer:null),
  approve:run(1,async(args,event):Promise<DropDelivery>=>{
   const r=args[0];if(busy||!exact(r,['token','target','approved'])||r.approved!==true||!session||session.approved||r.token!==session.offer.token||!session.offer.candidates.some(c=>c.target===r.target&&c.enabled))throw Error();
   busy=true;const s=session,generation=epoch;let dir:string|undefined;
   try{
    for(let p=root;p!==parse(p).root;p=dirname(p)){try{const info=await lstat(p);if(info.isSymbolicLink()||!info.isDirectory())throw Error();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
    await mkdir(root,{recursive:true,mode:0o700});dir=await mkdtemp(join(root,'drop-'));s.root=dir;
    for(const [i,f] of s.selected.entries()){
     const before=await probeDropFile(f.path);fresh(event,generation);if(!sameStamp(before.stamp,f.stamp))throw Error('Changed source');
     const bytes=await readSelectedPurchaseFile(f.path,[`.${f.meta.kind}`]);const after=await probeDropFile(f.path);fresh(event,generation);if(!sameStamp(after.stamp,f.stamp))throw Error('Changed source');
     const child=join(dir,String(i));await mkdir(child,{mode:0o700});f.snapshot=join(child,f.meta.name);f.hash=createHash('sha256').update(bytes).digest('hex');await writeFile(f.snapshot,bytes,{flag:'wx',mode:0o400});
    }
    fresh(event,generation);s.approved=r.target as DropTarget;arm(s,options.approvedTtl??600000);return {token:s.offer.token,target:s.approved,files:s.offer.files};
   }catch(e){if(session===s){session=null;epoch++;remove(s);}else if(dir)track(rm(dir,{recursive:true,force:true}));throw e;}finally{busy=false;}
  }),
  cancel:run(1,async args=>{get(args[0]);clear();return null;}),
  official:run(1,(args,event)=>consume(args[0],event,'official-document','official',()=>ports.official(event))),
  record:run(1,(args,event)=>consume(args[0],event,'record-helper','record',()=>ports.record(event))),
  purchase:run(1,(args,event)=>{const s=get(args[0],'purchase-helper',true),id=(args[0] as {sourceId:string}).sourceId,f=s.selected.find(f=>f.meta.id===id);if(!f||!['csv','xls','xlsx','pdf'].includes(f.meta.kind))throw Error();const kind=f.meta.kind==='xls'||f.meta.kind==='xlsx'?'excel':f.meta.kind as 'csv'|'pdf';return consume(args[0],event,'purchase-helper',kind,()=>ports.purchase(kind,event),true);}),
  images:run(1,(args,event)=>consume(args[0],event,'purchase-helper','images',()=>ports.images(event))),
  dispose:()=>{disposed=true;clear();},flush:async()=>{while(pending.size)await Promise.allSettled([...pending]);},
 };
 return {...handlers,stage:async(event:Event,...args:unknown[])=>{const result=await handlers.stage(event,...args);if(!disposed)publish(result);return result;}};
}
