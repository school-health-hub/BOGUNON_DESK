import {lstat,readFile,open,rename,unlink} from 'node:fs/promises';
import {dirname,basename,join,extname,isAbsolute,parse} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {assertSender} from './policy.js';
import type {IpcResult,NewsletterSaveResult} from '../protocol.js';
export function validateNewsletterSave(value:unknown):string{
 if(!value||typeof value!=='object'||Object.keys(value).join(',')!=='json')throw Error('Invalid request');
 const json=(value as {json:unknown}).json;
 if(typeof json!=='string'||Buffer.byteLength(json)>8*1024*1024)throw Error('Invalid size');
 const v=JSON.parse(json);
 if(!v||Object.keys(v).sort().join(',')!=='design,project'||v.project?.schemaVersion!==1||typeof v.project?.projectId!=='string'||!Number.isInteger(v.project?.projectRevision)||v.project.projectRevision<1||!Number.isInteger(v.design?.designRevision)||v.design.designRevision<1||!Number.isInteger(v.design?.canonicalProjectRevision)||v.design.canonicalProjectRevision<1||!/^([a-z0-9][a-z0-9-]{0,63})$/.test(v.project?.projectId)||v.design?.projectId!==v.project.projectId||![1,2].includes(v.design?.designSchemaVersion)||!Array.isArray(v.project?.revisionHistory)||!Array.isArray(v.design?.revisionHistory))throw Error('Invalid document envelope');
 return json;
}
async function fingerprint(path:string):Promise<string|null>{
 try{const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>16*1024*1024)throw Error('Unsafe target');return `${info.dev}:${info.ino}:`+createHash('sha256').update(await readFile(path)).digest('hex');}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
export async function writeSelectedJson(path:string,json:string,confirm:()=>Promise<boolean>,commit:typeof rename=rename):Promise<NewsletterSaveResult>{
 if(!isAbsolute(path)||extname(path).toLowerCase()!=='.json')throw Error('Invalid target');
 let parent=dirname(path);while(parent!==parse(parent).root){if((await lstat(parent)).isSymbolicLink())throw Error('Unsafe parent');parent=dirname(parent);}
 const before=await fingerprint(path);
 if(before!==null&&!await confirm())return {saved:false};
 const temp=join(dirname(path),`.newsletter-${randomUUID()}.tmp`);
 try{
  const file=await open(temp,'wx',0o600);try{await file.writeFile(json,'utf8');await file.sync();}finally{await file.close();}
  if(await fingerprint(path)!==before)throw Error('Target changed');
  await commit(temp,path);return {saved:true,fileName:basename(path)};
 }finally{await unlink(temp).catch(()=>{});}
}
export function createNewsletterSaveHandler(contents:Parameters<typeof assertSender>[1],url:string,ports:{pick:()=>Promise<string|undefined>;confirm:()=>Promise<boolean>}){
 let busy=false;
 return async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<NewsletterSaveResult>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 호출입니다.',retryable:false}};}
  let json:string;try{if(args.length!==1)throw Error('Invalid arity');json=validateNewsletterSave(args[0]);}catch{return {ok:false,error:{code:'INVALID_INPUT',message:'원고·디자인 JSON 형식을 확인해 주세요.',retryable:false}};}
  if(busy)return {ok:false,error:{code:'STORAGE_ERROR',message:'이미 저장 작업이 진행 중입니다.',retryable:true}};
  busy=true;try{const path=await ports.pick();return {ok:true,data:path?await writeSelectedJson(path,json,ports.confirm):{saved:false}};}
  catch{return {ok:false,error:{code:'STORAGE_ERROR',message:'JSON을 저장하지 못했습니다. 기존 파일은 보존했습니다.',retryable:true}};}finally{busy=false;}
 };
}
