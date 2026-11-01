import {assertSender} from './policy.js';
import {validateNewsletterSave} from './newsletter-json.js';
import {NewsletterProjects,ProjectConflict,projectId,type RestorePrompt} from './newsletter-projects.js';
import type {NewsletterHead,IpcResult} from '../protocol.js';
export const PROJECT_ACTIONS=['list','load','save','history','preview','restore'] as const;
function record(value:unknown,keys:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(','))throw Error('Invalid request');return value as Record<string,unknown>;}
function expected(value:unknown):NewsletterHead{const v=record(value,['projectId','revision','hash']);projectId(v.projectId);if(!Number.isInteger(v.revision)||(v.revision as number)<0||(v.revision as number)>100||typeof v.hash!=='string'||((v.revision===0)?v.hash!=='':!/^[a-f0-9]{64}$/.test(v.hash)))throw Error('Invalid head');return v as NewsletterHead;}
export function createProjectHandler(action:typeof PROJECT_ACTIONS[number],contents:Parameters<typeof assertSender>[1],url:string,store:NewsletterProjects,confirm:(info:RestorePrompt)=>Promise<boolean>){
 return async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<unknown>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 호출입니다.',retryable:false}};}
  let v:Record<string,unknown>={};let head:NewsletterHead|undefined;
  try{
   if(args.length!==(action==='list'?0:1))throw Error('Invalid arity');
   if(action==='load'||action==='history'){v=record(args[0],['projectId']);projectId(v.projectId);}
   if(action==='save'){v=record(args[0],['document','expected']);validateNewsletterSave({json:v.document});head=expected(v.expected);}
   if(action==='preview'){v=record(args[0],['projectId','revision']);projectId(v.projectId);if(!Number.isInteger(v.revision)||(v.revision as number)<1||(v.revision as number)>100)throw Error('Invalid revision');}
   if(action==='restore'){v=record(args[0],['token','expected']);head=expected(v.expected);if(typeof v.token!=='string'||!/^[a-f0-9-]{36}$/.test(v.token))throw Error('Invalid preview token');}
  }catch{return {ok:false,error:{code:'INVALID_INPUT',message:'프로젝트 ID·원고·revision 입력을 확인해 주세요.',retryable:false}};}
  try{
   let data:unknown;
   switch(action){case 'list':data=await store.list();break;case 'load':data=await store.load(v.projectId as string);break;case 'save':data=await store.save(v.document as string,head!);break;case 'history':data=await store.history(v.projectId as string);break;case 'preview':data=await store.preview(v.projectId as string,v.revision as number);break;case 'restore':data=await store.restore(v.token as string,head!,confirm);break;}
   return {ok:true,data};
  }catch(e){return e instanceof ProjectConflict?{ok:false,error:{code:'CONFLICT',message:'저장된 원고가 변경되었습니다. 다시 불러온 뒤 비교해 주세요. 현재 편집 내용은 유지됩니다.',retryable:false}}:{ok:false,error:{code:'STORAGE_ERROR',message:'프로젝트 또는 revision을 처리하지 못했습니다. 원본 파일을 보존했습니다. 손상·이미지 참조·저장 공간을 확인해 주세요.',retryable:true}};}
 };
}
