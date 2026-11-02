import {mkdir,mkdtemp,writeFile,rm,lstat,link,unlink,open} from 'node:fs/promises';
import {basename,dirname,extname,isAbsolute,join,parse} from 'node:path';
import {randomUUID} from 'node:crypto';
import {assertSender} from './policy.js';
import {readSelectedPurchaseFile} from './purchase-import.js';
import {runExcelCli} from './purchase-excel.js';
import type {OfficialDocumentSave,OfficialDocumentImported,IpcResult} from '../protocol.js';

export function validateDocument(value:unknown):OfficialDocumentSave {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='attachments,body,hasTableText,title')throw Error();
 const r=value as OfficialDocumentSave;
 if(typeof r.hasTableText!=='boolean'||[r.title,r.body,r.attachments].some(s=>typeof s!=='string'||s.includes('\0')||Buffer.byteLength(s)>500_000)||!r.title.trim()||!r.body.trim())throw Error();
 return {...r};
}
/** Atomic no-clobber publication: even an existing file selected in the dialog is never replaced. */
export async function saveNewOdt(path:string,bytes:Buffer,fresh:()=>void){
 if(!isAbsolute(path)||extname(path).toLowerCase()!=='.odt'||!bytes.length||bytes.length>25*1024*1024)throw Error();
 const checkParents=async()=>{for(let p=dirname(path);p!==parse(p).root;p=dirname(p)){const s=await lstat(p);if(!s.isDirectory()||s.isSymbolicLink())throw Error();}};
 await checkParents();fresh();const temp=join(dirname(path),`.official-${randomUUID()}.tmp`);let created=false;
 try{const f=await open(temp,'wx',0o600);created=true;try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}
  await checkParents();fresh();await link(temp,path);return basename(path);
 }finally{if(created)await unlink(temp).catch(()=>{});}
}
export class OfficialDocumentService {
 private readonly pending=new Set<Promise<unknown>>();
 constructor(private readonly executable:string,private readonly tempRoot:string){}
 private track<T>(p:Promise<T>):Promise<T>{this.pending.add(p);void p.finally(()=>this.pending.delete(p)).catch(()=>{});return p;}
 async flush(){await Promise.allSettled([...this.pending]);}
 import(path:string,signal:AbortSignal){return this.track(this.read(path,signal));}
 private async read(path:string,signal:AbortSignal):Promise<OfficialDocumentImported>{
  const bytes=await readSelectedPurchaseFile(path,['.pdf','.hwpx','.odt']);if(signal.aborted)throw Error();
  await mkdir(this.tempRoot,{recursive:true,mode:0o700});const dir=await mkdtemp(join(this.tempRoot,'import-'));
  try{const snapshot=join(dir,`input${extname(path).toLowerCase()}`);await writeFile(snapshot,bytes,{flag:'wx',mode:0o600});
   const result=await runExcelCli(this.executable,{operation:'import',path:snapshot},signal,30_000,undefined,value=>{
    const r=value as OfficialDocumentImported;if(!r||!['pdf','hwpx','odt'].includes(r.format)||typeof r.text!=='string'||!r.text.trim()||Buffer.byteLength(r.text)>2*1024*1024)throw Error();return r;
   });return {sourceName:basename(path),format:result.format,text:result.text};
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 generate(document:OfficialDocumentSave,signal:AbortSignal):Promise<Buffer>{return this.track(runExcelCli(this.executable,{operation:'odt',document},signal,30_000,undefined,value=>{
  const r=value as {bytesBase64:string};if(!r||typeof r.bytesBase64!=='string'||r.bytesBase64.length>36*1024*1024||! /^[A-Za-z0-9+/]*={0,2}$/.test(r.bytesBase64))throw Error();const b=Buffer.from(r.bytesBase64,'base64');if(!b.subarray(0,4).equals(Buffer.from([80,75,3,4])))throw Error();return b;
 }));}
}
export function createOfficialDocumentHandlers(contents:Parameters<typeof assertSender>[1],url:string,ports:{service:Pick<OfficialDocumentService,'import'|'generate'>;pick:()=>Promise<string|undefined>;save:()=>Promise<string|undefined>;review:()=>Promise<boolean>;write?:typeof saveNewOdt}){
 let controller:AbortController|undefined,busy=false;
 const allowed=(e:Parameters<typeof assertSender>[0])=>{try{assertSender(e,contents,url);return true;}catch{return false;}};
 const error=(code:'FORBIDDEN'|'INVALID_INPUT'|'STORAGE_ERROR'):IpcResult<never>=>({ok:false,error:{code,message:code==='FORBIDDEN'?'허용되지 않은 호출입니다.':code==='INVALID_INPUT'?'공문 입력 형식을 확인해 주세요.':'파일 처리에 실패했습니다. 기존 원고와 파일은 변경하지 않았습니다. 스캔 PDF·암호화·손상·크기 제한 또는 기존 저장 파일 여부를 확인해 주세요.',retryable:code!=='FORBIDDEN'}});
 const handle=async(e:Parameters<typeof assertSender>[0],operation:'import'|'save',args:unknown[]):Promise<IpcResult<OfficialDocumentImported|{fileName:string}|null>>=>{
  if(!allowed(e))return error('FORBIDDEN');let document:OfficialDocumentSave|undefined;
  try{if(operation==='import'){if(args.length)throw Error();}else{if(args.length!==1)throw Error();document=validateDocument(args[0]);}}catch{return error('INVALID_INPUT');}
  if(busy)return error('STORAGE_ERROR');busy=true;const current=new AbortController();controller=current;
  const fresh=()=>{if(current.signal.aborted||!allowed(e))throw Error();};
  try{fresh();if(operation==='import'){const path=await ports.pick();fresh();if(!path)return {ok:true,data:null};const r=await ports.service.import(path,current.signal);fresh();return {ok:true,data:r};}
   if(!await ports.review())return {ok:true,data:null};fresh();const bytes=await ports.service.generate(document!,current.signal);fresh();const path=await ports.save();fresh();if(!path)return {ok:true,data:null};const fileName=await (ports.write??saveNewOdt)(path,bytes,fresh);return {ok:true,data:{fileName}};
  }catch{return current.signal.aborted?{ok:true,data:null}:error('STORAGE_ERROR');}finally{busy=false;}
 };
 return {pick:(e:Parameters<typeof assertSender>[0],...args:unknown[])=>handle(e,'import',args),save:(e:Parameters<typeof assertSender>[0],...args:unknown[])=>handle(e,'save',args),cancel:(e:Parameters<typeof assertSender>[0],...args:unknown[]):IpcResult<null>=>{if(!allowed(e))return error('FORBIDDEN');if(args.length)return error('INVALID_INPUT');controller?.abort();return {ok:true,data:null};},dispose:()=>controller?.abort()};
}
