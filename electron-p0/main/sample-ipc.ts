import type { IpcResult, SyntheticSummary, SyntheticSummaryRequest, SyntheticTaskId } from '../protocol.js';
import { assertSender } from './policy.js';
export const SAMPLE_SUMMARY_CHANNEL = 'p2:sample:summary';
const tasks: readonly SyntheticTaskId[] = ['prepare','review','finish'];
export function validateSyntheticRequest(value:unknown):SyntheticSummaryRequest {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid input');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='completed,fixture'||v.fixture!=='synthetic-only'||!Array.isArray(v.completed)||v.completed.length>3||Array.from(v.completed).some(id=>typeof id!=='string'||!tasks.includes(id as SyntheticTaskId))||new Set(v.completed).size!==v.completed.length)throw Error('Invalid input');
 return {fixture:'synthetic-only',completed:[...v.completed] as SyntheticTaskId[]};
}
export function summarizeSynthetic(request:SyntheticSummaryRequest):SyntheticSummary {
 return {fixture:'synthetic-only',total:3,completedCount:request.completed.length,pending:tasks.filter(id=>!request.completed.includes(id))};
}
export function createSampleHandler(contents:Parameters<typeof assertSender>[1],url:string,service=summarizeSynthetic) {
 return (event:Parameters<typeof assertSender>[0],...args:unknown[]):IpcResult<SyntheticSummary>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 호출입니다.',retryable:false}};}
  let request:SyntheticSummaryRequest;
  try{if(args.length!==1)throw Error('Invalid arity');request=validateSyntheticRequest(args[0]);}catch{return {ok:false,error:{code:'INVALID_INPUT',message:'합성 샘플 입력 형식을 확인해 주세요.',retryable:false}};}
  try{return {ok:true,data:service(request)};}catch{return {ok:false,error:{code:'INTERNAL_ERROR',message:'샘플 처리를 완료하지 못했습니다.',retryable:true}};}
 };
}
