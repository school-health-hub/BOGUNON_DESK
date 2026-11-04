import {lstat} from 'node:fs/promises';import {basename,extname,isAbsolute} from 'node:path';
import type {IpcResult} from '../protocol.js';import type {RecordImportBatch,RecordReviewedRequest} from '../record-helper-protocol.js';
import {assertSender} from './policy.js';
import {evaluateRecordHelperOutbound} from './record-helper/recordHelperAiService.js';
import {normalizeImportBatch} from './record-helper/import-contract.js';
import type {RecordHelperProcess} from './record-helper-process.js';
import type {ChatGptService} from './chatgpt-service.js';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateReviewedRequest(v:unknown):RecordReviewedRequest{
 if(!object(v)||Object.keys(v).sort().join(',')!=='accountId,approved,identityHints,model,packet,reportId,requestId'||v.approved!==true||typeof v.accountId!=='string'||!(/^[a-f0-9]{64}$/).test(v.accountId)||typeof v.model!=='string'||v.model.length>200||typeof v.reportId!=='string'||!v.reportId||v.reportId.length>2048||!Number.isSafeInteger(v.requestId)||Number(v.requestId)<1||!Array.isArray(v.identityHints)||v.identityHints.length>2||v.identityHints.some(h=>typeof h!=='string'||h.length>2000)||!object(v.packet)||Object.keys(v.packet).sort().join(',')!=='reportText,teacherMemo')throw Error('Invalid packet');
 const p=v.packet;if(typeof p.reportText!=='string'||typeof p.teacherMemo!=='string'||Buffer.byteLength(p.reportText)+Buffer.byteLength(p.teacherMemo)>65536||p.reportText.includes('\0')||p.teacherMemo.includes('\0')||!evaluateRecordHelperOutbound(p.reportText,p.teacherMemo,v.identityHints).canConfirm)throw Error('Unsafe packet');return structuredClone(v) as RecordReviewedRequest;
}
export function createRecordHelperHandlers(contents:Parameters<typeof assertSender>[1],url:string,ports:{pick:()=>Promise<readonly string[]|undefined>;extractor:Pick<RecordHelperProcess,'run'|'flush'>;chatgpt:Pick<ChatGptService,'generateRecord'|'snapshot'>;timeoutMs?:number;batchMs?:number}){
 let epoch=0,disposed=false,importing=false,importAbort:AbortController|null=null,active:{reportId:string;controller:AbortController}|null=null;
 const fresh=(event:Parameters<typeof assertSender>[0])=>{assertSender(event,contents,url);if(disposed)throw Error('Closed');};
 const run=<T>(count:number,action:(args:unknown[],event:Parameters<typeof assertSender>[0])=>Promise<T>)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<T>>=>{
  try{fresh(event);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 생기부 요청입니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:'생기부 요청에는 파일 경로나 추가 인수를 전달할 수 없습니다.',retryable:false}};
  try{return {ok:true,data:await action(args,event)};}catch{return {ok:false,error:{code:'INTERNAL_ERROR',message:'생기부 작업을 완료하지 못했습니다. 기존 학생 자료는 유지됩니다. 전송본·ChatGPT 연결·파일 제한을 확인해 주세요.',retryable:true}};}
 };
 const cancelImport=()=>{epoch++;importAbort?.abort();};
 const clear=()=>{cancelImport();active?.controller.abort();};
 return {
  pick:run(0,async(_args,event):Promise<RecordImportBatch|null>=>{
   if(importing)throw Error('Busy');importing=true;const controller=new AbortController(),generation=++epoch;importAbort=controller;
   let timeout:ReturnType<typeof setTimeout>|undefined,timedOut=false;
   try{
    const paths=await new Promise<readonly string[]|undefined>((resolve,reject)=>{const stop=()=>reject(Error('Canceled'));controller.signal.addEventListener('abort',stop,{once:true});ports.pick().then(p=>{controller.signal.removeEventListener('abort',stop);resolve(p);},reject);});
    fresh(event);if(controller.signal.aborted||epoch!==generation||!paths)return null;
    timeout=setTimeout(()=>{timedOut=true;controller.abort();},ports.batchMs??180000);
    if(paths.length>50)throw Error('Batch limit');let sourceBytes=0,textBytes=0;const reports:RecordImportBatch['reports'][number][]=[],failures:RecordImportBatch['failures'][number][]=[];
    const selected: {path:string;name:string;size:number;ino:number|bigint;dev:number|bigint;mtime:number;ctime:number}[]=[];
    for(const path of paths){const name=basename(path);if(!isAbsolute(path))throw Error('Unsafe selection');if(!name||name.length>1000||/[\\:\0]/.test(name)){failures.push({sourceName:'선택한 파일',message:'파일 이름 형식을 확인해 주세요.'});continue;}const info=await lstat(path).catch(()=>null);if(info)sourceBytes+=info.size;if(sourceBytes>150*1024*1024)throw Error('Batch limit');
     if(!info?.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>15*1024*1024||!['.pdf','.hwp','.hwpx','.docx'].includes(extname(path).toLowerCase())){failures.push({sourceName:name,message:'파일 형식·15MiB 제한·일반 파일 여부를 확인해 주세요.'});continue;}selected.push({path,name,size:info.size,ino:info.ino,dev:info.dev,mtime:info.mtimeMs,ctime:info.ctimeMs});
    }
    for(const file of selected){
     if(epoch!==generation)return null;
     if(timedOut){failures.push({sourceName:file.name,message:'전체 처리시간 제한으로 이 파일을 추출하지 못했습니다. 다시 선택해 주세요.'});continue;}
     if(controller.signal.aborted)return null;
     try{fresh(event);const batch=await ports.extractor.run(file.path,controller.signal),after=await lstat(file.path);fresh(event);
      if(epoch!==generation)return null;
      if(timedOut)throw Error('Batch timeout');
      if(controller.signal.aborted)return null;
      if(after.isSymbolicLink()||after.ino!==file.ino||after.dev!==file.dev||after.size!==file.size||after.mtimeMs!==file.mtime||after.ctimeMs!==file.ctime||!batch||batch.reports.length+batch.failures.length!==1)throw Error('Changed');
      if(batch.reports.length){const report=batch.reports[0];if(report.sourceName!==file.name||report.format!==extname(file.path).slice(1).toLowerCase()||textBytes+Buffer.byteLength(report.text)>20*1024*1024)throw Error('Payload');textBytes+=Buffer.byteLength(report.text);reports.push(report);}else {if(batch.failures[0].sourceName!==file.name)throw Error('Payload');failures.push(...batch.failures);}
     }catch{if(epoch!==generation||controller.signal.aborted&&!timedOut)return null;failures.push({sourceName:file.name,message:'추출 실패 또는 처리시간 초과입니다. 손상·암호화·스캔 문서 여부를 확인해 주세요.'});}
    }
    return normalizeImportBatch({reports,failures});
   }catch(e){if(controller.signal.aborted||epoch!==generation)return null;throw e;}finally{clearTimeout(timeout);if(importAbort===controller)importAbort=null;importing=false;}
  }),
  cancelImport:run(0,async()=>{cancelImport();return null;}),
  generateReviewed:run(1,async(args,event)=>{
   const request=validateReviewedRequest(args[0]),state=ports.chatgpt.snapshot();if(active||state.busy||state.phase!=='ready'||!state.planUsageEnabled||state.accountId!==request.accountId||state.model!==request.model)throw Error('Unavailable account/model');const controller=new AbortController(),current={reportId:request.reportId,controller};active=current;
   let timeout=false;const timer=setTimeout(()=>{timeout=true;controller.abort();},ports.timeoutMs??120000);
   try{const prompt=evaluateRecordHelperOutbound(request.packet.reportText,request.packet.teacherMemo,request.identityHints).prompt;fresh(event);const result=await ports.chatgpt.generateRecord(prompt,controller.signal);fresh(event);if(timeout)throw Error('Timeout');if(controller.signal.aborted||active!==current)return null;return result;}
   finally{clearTimeout(timer);if(active===current)active=null;}
  }),
  cancelAi:run(1,async args=>{const r=args[0];if(!object(r)||Object.keys(r).join(',')!=='reportId'||typeof r.reportId!=='string')throw Error();if(active?.reportId===r.reportId)active.controller.abort();return null;}),
  clear:run(0,async()=>{clear();return null;}),
  dispose:()=>{disposed=true;clear();},flush:()=>ports.extractor.flush(),
 };
}
