import {lstat} from 'node:fs/promises'
import {dirname,join,parse} from 'node:path'
import {LocalTaskDocument,LocalTaskLoad,emptyLocalTasks,validateLocalTasks} from '../local-tasks.js'
import {SettingsStore} from './settings.js'
import {assertSender} from './policy.js'
import type {IpcResult} from '../protocol.js'
export class TaskConflict extends Error{}
export class LocalTaskStore{
 private queue:Promise<void>=Promise.resolve()
 private primary:SettingsStore<LocalTaskDocument>
 private backup:SettingsStore<LocalTaskDocument>
 constructor(private readonly root:string,private readonly writePrimary?:(document:LocalTaskDocument)=>Promise<void>){this.primary=new SettingsStore(root,'tasks.json',validateLocalTasks,2*1024*1024);this.backup=new SettingsStore(root,'tasks.backup.json',validateLocalTasks,2*1024*1024)}
 private async safe(){
  for(let p=this.root;p!==parse(p).root;p=dirname(p)){try{const info=await lstat(p);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Unsafe local task directory')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
  for(const name of ['tasks.json','tasks.backup.json']){try{const info=await lstat(join(this.root,name));if(info.isSymbolicLink()||!info.isFile()||info.nlink!==1)throw Error('Unsafe local task file')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
 }
 async load():Promise<LocalTaskLoad>{
  await this.safe()
  try{const document=await this.primary.read();if(document)return {document,recovered:false};const backup=await this.backup.read();return backup?{document:backup,recovered:true}:{document:emptyLocalTasks(),recovered:false}}
  catch{const backup=await this.backup.read();if(backup)return {document:backup,recovered:true};throw Error('Local task files unreadable')}
 }
 save(value:unknown,expectedRevision:unknown):Promise<LocalTaskLoad>{
  const document=validateLocalTasks(value)
  if(!Number.isSafeInteger(expectedRevision)||Number(expectedRevision)<0||document.revision!==expectedRevision)throw Error('Invalid task revision')
  const task=this.queue.then(async()=>{
   const current=await this.load();if(current.recovered)throw Error('Recovered backup is read only')
   if(current.document.revision!==expectedRevision)throw new TaskConflict()
   const next=validateLocalTasks({...document,revision:Number(expectedRevision)+1})
   if(current.document.revision>0)await this.backup.write(current.document)
   await (this.writePrimary?this.writePrimary(next):this.primary.write(next))
   return {document:next,recovered:false}
  });this.queue=task.then(()=>{},()=>{});return task
 }
 flush(){return this.queue}
}
export function createLocalTaskHandlers(contents:Parameters<typeof assertSender>[1],url:string,store:LocalTaskStore){
 const run=async(event:Parameters<typeof assertSender>[0],args:unknown[],save:boolean):Promise<IpcResult<LocalTaskLoad>>=>{
  try{assertSender(event,contents,url)}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 업무 요청입니다.',retryable:false}}}
  if((save&&args.length!==2)||(!save&&args.length))return {ok:false,error:{code:'INVALID_INPUT',message:'업무 입력 형식을 확인해 주세요.',retryable:false}}
  if(save){try{const doc=validateLocalTasks(args[0]);if(!Number.isSafeInteger(args[1])||Number(args[1])<0||doc.revision!==args[1])throw Error('Invalid revision')}catch{return {ok:false,error:{code:'INVALID_INPUT',message:'업무 제목·날짜·입력 형식을 확인해 주세요.',retryable:false}}}}
  try{return {ok:true,data:save?await store.save(args[0],args[1]):await store.load()}}
  catch(e){return {ok:false,error:{code:e instanceof TaskConflict?'CONFLICT':'STORAGE_ERROR',message:e instanceof TaskConflict?'업무가 다른 요청에서 변경됐습니다. 다시 불러온 뒤 저장해 주세요.':'업무를 저장하거나 불러오지 못했습니다. 기존 파일과 입력을 보존합니다.',retryable:true}}}
 }
 return {load:(event:Parameters<typeof assertSender>[0],...args:unknown[])=>run(event,args,false),save:(event:Parameters<typeof assertSender>[0],...args:unknown[])=>run(event,args,true)}
}
