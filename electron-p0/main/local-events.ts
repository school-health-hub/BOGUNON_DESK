import {lstat} from 'node:fs/promises';
import {dirname,join,parse} from 'node:path';
import {SettingsStore} from './settings.js';
import {assertSender} from './policy.js';
import {emptyEvents,eventId,eventKeys,eventTimestamp,validateEventDraft,validateEvents,type EventDocument,type EventLoad,type EventSave,type EventRemove} from '../local-events.js';
import type {IpcResult} from '../protocol.js';
export class EventConflict extends Error{}
export class LocalEventStore{
 private queue:Promise<void>=Promise.resolve();
 private primary:SettingsStore<EventDocument>;private backup:SettingsStore<EventDocument>;
 constructor(private readonly root:string,private readonly writePrimary?:(document:EventDocument)=>Promise<void>,private readonly now=()=>new Date()){
  this.primary=new SettingsStore(root,'events.json',validateEvents,2*1024*1024);this.backup=new SettingsStore(root,'events.backup.json',validateEvents,2*1024*1024);
 }
 private async safe(){
  for(let p=this.root;p!==parse(p).root;p=dirname(p)){try{const entry=await lstat(p);if(entry.isSymbolicLink()||!entry.isDirectory())throw Error('Unsafe event directory');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  for(const name of ['events.json','events.backup.json']){try{const entry=await lstat(join(this.root,name));if(!entry.isFile()||entry.isSymbolicLink()||entry.nlink!==1)throw Error('Unsafe event file');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 }
 private async readChecked(store:SettingsStore<EventDocument>,name:string){
  try{if((await lstat(join(this.root,name))).size>2*1024*1024)throw Error('Oversized event file');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  return store.read();
 }
 async load():Promise<EventLoad>{
  await this.safe();try{const document=await this.readChecked(this.primary,'events.json');if(document)return {document,recovered:false};const backup=await this.readChecked(this.backup,'events.backup.json');return {document:backup??emptyEvents(),recovered:!!backup};}
  catch{const document=await this.readChecked(this.backup,'events.backup.json');if(document)return {document,recovered:true};throw Error('일정 원본을 읽을 수 없습니다. 기존 파일을 보존합니다.');}
 }
 private run(action:()=>Promise<EventLoad>){const job=this.queue.then(action);this.queue=job.then(()=>{},()=>{});return job;}
 private async write(document:EventDocument,previous:EventDocument){const next=validateEvents(document);if(previous.revision>0)await this.backup.write(previous);await (this.writePrimary?this.writePrimary(next):this.primary.write(next));return {document:next,recovered:false};}
 save(input:unknown):Promise<EventLoad>{
  if(!eventKeys(input,['event','expectedRevision','expectedUpdatedAt'])||!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0||input.expectedUpdatedAt!==null&&!eventTimestamp(input.expectedUpdatedAt))throw Error('Invalid event request');
  const request=input as EventSave,event=validateEventDraft(request.event);
  return this.run(async()=>{const state=await this.load();if(state.recovered)throw Error('Recovered backup is read only');const current=state.document,existing=current.events.find(row=>row.id===event.id);
   if(existing&&Object.keys(event).every(key=>existing[key as keyof typeof existing]===event[key as keyof typeof event]))return state;
   if(current.revision!==request.expectedRevision||existing?.updatedAt!==request.expectedUpdatedAt&&!(existing===undefined&&request.expectedUpdatedAt===null))throw new EventConflict();
   const stamp=this.now().toISOString(),updatedAt=existing&&stamp<=existing.updatedAt?new Date(Date.parse(existing.updatedAt)+1).toISOString():stamp;
   const saved={...event,createdAt:existing?.createdAt??stamp,updatedAt};return this.write({...current,revision:current.revision+1,events:[...current.events.filter(row=>row.id!==event.id),saved]},current);
  });
 }
 remove(input:unknown):Promise<EventLoad>{
  if(!eventKeys(input,['id','expectedRevision','expectedUpdatedAt','confirmed'])||!eventId(input.id)||!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0||!eventTimestamp(input.expectedUpdatedAt)||input.confirmed!==true)throw Error('Invalid event removal');const request=input as EventRemove;
  return this.run(async()=>{const state=await this.load();if(state.recovered)throw Error('Recovered backup is read only');const current=state.document,existing=current.events.find(row=>row.id===request.id);if(!existing)return state;
   if(current.revision!==request.expectedRevision||existing.updatedAt!==request.expectedUpdatedAt)throw new EventConflict();return this.write({...current,revision:current.revision+1,events:current.events.filter(row=>row.id!==request.id)},current);
  });
 }
 flush(){return this.queue;}
}
export function createLocalEventHandlers(contents:Parameters<typeof assertSender>[1],url:string,store:LocalEventStore){
 const call=(name:'load'|'save'|'remove')=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<EventLoad>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 일정 요청입니다.',retryable:false}};}
  if(args.length!==(name==='load'?0:1))return {ok:false,error:{code:'INVALID_INPUT',message:'일정 요청 형식을 확인해 주세요.',retryable:false}};
  try{return {ok:true,data:await (name==='load'?store.load():store[name](args[0]))};}
  catch(e){return {ok:false,error:{code:e instanceof EventConflict?'CONFLICT':'STORAGE_ERROR',message:e instanceof EventConflict?'일정이 다른 요청에서 변경됐습니다. 입력을 유지하고 다시 불러와 확인해 주세요.':'일정을 저장하거나 불러오지 못했습니다. 기존 파일과 입력을 유지합니다.',retryable:true}};}
 };return {load:call('load'),save:call('save'),remove:call('remove')};
}
