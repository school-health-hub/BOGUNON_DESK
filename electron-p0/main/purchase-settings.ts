import {lstat} from 'node:fs/promises';
import {dirname,join,parse} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import type {PurchaseSettingsDocument,PurchaseSettingsLoad} from '../purchase-settings-protocol.js';
import type {IpcResult} from '../protocol.js';
import {normalizePurchaseDraftTemplates,normalizePurchaseImportTemplates} from './purchase-settings-normalize.js';
import {defaultPurchaseOutputColumns} from './purchase-domain-types.js';
import {normalizePurchaseOutputColumns} from './purchase-domain.js';
import {SettingsStore} from './settings.js';
import {assertSender} from './policy.js';

export const emptyPurchaseSettings=():PurchaseSettingsDocument=>({version:1,revision:0,draftTemplates:[],importTemplates:[],outputColumns:[...defaultPurchaseOutputColumns]});
export function validatePurchaseSettings(value:unknown):PurchaseSettingsDocument{
 const bad=()=>{throw Error('Invalid purchase settings');};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();
 const d=value as PurchaseSettingsDocument;
 if(Object.keys(d).sort().join(',')!=='draftTemplates,importTemplates,outputColumns,revision,version'||d.version!==1||!Number.isSafeInteger(d.revision)||d.revision<0||d.revision>=Number.MAX_SAFE_INTEGER)return bad();
 if(!Array.isArray(d.draftTemplates)||d.draftTemplates.length>10||!Array.isArray(d.importTemplates)||d.importTemplates.length>20||!Array.isArray(d.outputColumns))return bad();
 const json=JSON.stringify(d);if(Buffer.byteLength(json)>128*1024||json.includes('\\u0000'))return bad();
 // Reuse the original canonical contracts, but never repair/truncate a damaged file silently.
 if(!isDeepStrictEqual(d.draftTemplates,normalizePurchaseDraftTemplates(d.draftTemplates))||!isDeepStrictEqual(d.importTemplates,normalizePurchaseImportTemplates(d.importTemplates))||!isDeepStrictEqual(d.outputColumns,normalizePurchaseOutputColumns(d.outputColumns)))return bad();
 const ids=new Set<string>();
 for(const t of [...d.draftTemplates,...d.importTemplates]){
  if(!t.id||t.id.length>200||t.id.includes('\0')||ids.has(t.id))return bad();ids.add(t.id);
  if('headerSignature' in t&&(t.headerSignature.length>256||t.headerSignature.some((h:string)=>h.length>500||h.includes('\0'))))return bad();
 }
 return JSON.parse(json) as PurchaseSettingsDocument;
}
export class PurchaseSettingsConflict extends Error{}
export class PurchaseSettingsStore{
 private queue:Promise<void>=Promise.resolve();
 private primary:SettingsStore<PurchaseSettingsDocument>;
 private backup:SettingsStore<PurchaseSettingsDocument>;
 constructor(private readonly root:string,private readonly writePrimary?:(document:PurchaseSettingsDocument)=>Promise<void>){
  this.primary=new SettingsStore(root,'settings.json',validatePurchaseSettings,128*1024);
  this.backup=new SettingsStore(root,'settings.backup.json',validatePurchaseSettings,128*1024);
 }
 private async safe(){
  for(let p=this.root;p!==parse(p).root;p=dirname(p)){try{const s=await lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsafe settings directory');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  for(const name of ['settings.json','settings.backup.json']){try{const s=await lstat(join(this.root,name));if(s.isSymbolicLink()||!s.isFile()||s.nlink!==1)throw Error('Unsafe settings file');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 }
 async load():Promise<PurchaseSettingsLoad>{
  await this.safe();
  try{const d=await this.primary.read();if(d)return {document:d,recovered:false};const backup=await this.backup.read();return backup?{document:backup,recovered:true}:{document:emptyPurchaseSettings(),recovered:false};}
  catch{const backup=await this.backup.read();if(backup)return {document:backup,recovered:true};throw Error('Purchase settings unreadable; originals preserved');}
 }
 save(value:unknown,expectedRevision:unknown):Promise<PurchaseSettingsLoad>{
  const document=validatePurchaseSettings(value);
  if(!Number.isSafeInteger(expectedRevision)||document.revision!==expectedRevision)throw Error('Invalid revision');
  const task=this.queue.then(async()=>{
   const current=await this.load();if(current.recovered)throw Error('Recovered settings are read only');
   if(current.document.revision!==expectedRevision)throw new PurchaseSettingsConflict();
   const next=validatePurchaseSettings({...document,revision:document.revision+1});
   if(current.document.revision>0)await this.backup.write(current.document);
   await (this.writePrimary?this.writePrimary(next):this.primary.write(next));
   return {document:next,recovered:false};
  });this.queue=task.then(()=>{},()=>{});return task;
 }
 flush(){return this.queue;}
}
export function createPurchaseSettingsHandlers(contents:Parameters<typeof assertSender>[1],url:string,store:PurchaseSettingsStore){
 const run=async(event:Parameters<typeof assertSender>[0],args:unknown[],save:boolean):Promise<IpcResult<PurchaseSettingsLoad>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 Purchase 설정 요청입니다.',retryable:false}};}
  try{if(args.length!==(save?2:0))throw Error();if(save){const d=validatePurchaseSettings(args[0]);if(d.revision!==args[1])throw Error();}}
  catch{return {ok:false,error:{code:'INVALID_INPUT',message:'Purchase 설정 형식·버전·개수를 확인해 주세요.',retryable:false}};}
  try{return {ok:true,data:save?await store.save(args[0],args[1]):await store.load()};}
  catch(e){return {ok:false,error:{code:e instanceof PurchaseSettingsConflict?'CONFLICT':'STORAGE_ERROR',message:e instanceof PurchaseSettingsConflict?'Purchase 설정이 다른 요청에서 변경됐습니다. 다시 불러와 확인해 주세요.':'Purchase 설정을 저장하거나 읽지 못했습니다. 기존 파일·품목·원고를 보존합니다.',retryable:true}};}
 };
 return {load:(event:Parameters<typeof assertSender>[0],...args:unknown[])=>run(event,args,false),save:(event:Parameters<typeof assertSender>[0],...args:unknown[])=>run(event,args,true)};
}
