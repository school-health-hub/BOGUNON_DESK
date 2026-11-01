import type {MemoDocument,IpcResult} from '../protocol.js';
import {SettingsStore} from './settings.js';
import {assertSender} from './policy.js';
export function validateMemo(value:unknown):MemoDocument {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid memo');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='text,version'||v.version!==1||typeof v.text!=='string'||v.text.length>8000)throw Error('Invalid memo');
 return {version:1,text:v.text};
}
export class MemoStore {
 private queue:Promise<unknown>=Promise.resolve();
 private readonly file:SettingsStore<MemoDocument>;
 constructor(root:string){this.file=new SettingsStore(root,'memo.json',validateMemo);}
 private enqueue<T>(operation:()=>Promise<T>):Promise<T>{const next=this.queue.then(operation);this.queue=next.catch(()=>{});return next;}
 read(){return this.enqueue(async()=>await this.file.read()??{version:1 as const,text:''});}
 write(value:unknown){const doc=validateMemo(value);return this.enqueue(async()=>{
  // Refuse to overwrite unreadable/corrupt existing data, including direct IPC calls.
  await this.file.read();await this.file.write(doc);return doc;
 });}
 async flush(){await this.queue;}
}
export function createMemoHandlers(contents:Parameters<typeof assertSender>[1],url:string,store:MemoStore){
 const handle=(write:boolean)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<MemoDocument>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 호출입니다.',retryable:false}};}
  let doc:MemoDocument|undefined;
  try{if(args.length!==(write?1:0))throw Error('Invalid arity');if(write)doc=validateMemo(args[0]);}
  catch{return {ok:false,error:{code:'INVALID_INPUT',message:'메모는 8,000자 이내로 입력해 주세요.',retryable:false}};}
  try{return {ok:true,data:doc?await store.write(doc):await store.read()};}
  catch{return {ok:false,error:{code:'STORAGE_ERROR',message:'메모 파일을 처리하지 못했습니다. 기존 파일을 보존했습니다.',retryable:true}};}
 };
 return {read:handle(false),write:handle(true)};
}
