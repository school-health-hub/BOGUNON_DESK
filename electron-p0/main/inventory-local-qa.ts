import {request} from 'node:http';
import {assertSender} from './policy.js';
import type {InventoryQaStatus,IpcResult} from '../protocol.js';

export const INVENTORY_QA_HEALTH='http://127.0.0.1:56321/auth/v1/health';
export function inventoryQaAllowed(config:{packaged:boolean;devUrl?:string;optIn?:string}):boolean {
 return !config.packaged && config.devUrl==='http://127.0.0.1:5174/' && config.optIn==='1';
}
// No renderer URL, headers, credentials, body or endpoint configuration. This
// checks only Auth gateway reachability, never PostgreSQL/RLS/RPC readiness.
export function probeInventoryQa():Promise<boolean>{
 return new Promise(resolve=>{
  let settled=false,bytes=0;
  const done=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(deadline);req.destroy();resolve(ok);};
  const req=request(INVENTORY_QA_HEALTH,{method:'GET',agent:false},res=>{
   res.on('data',(data:Buffer)=>{bytes+=data.length;if(bytes>16*1024)done(false);});
   res.on('end',()=>done(res.statusCode===200));
   res.on('error',()=>done(false));
   res.on('aborted',()=>done(false));
  });
  const deadline=setTimeout(()=>done(false),3000);
  req.on('error',()=>done(false));req.end();
 });
}
export function createInventoryQaStatusHandler(
 contents:Parameters<typeof assertSender>[1],url:string,
 config:{packaged:boolean;devUrl?:string;optIn?:string},probe:()=>Promise<boolean>=probeInventoryQa,
){
 let busy=false;
 return async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<InventoryQaStatus>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 호출입니다.',retryable:false}};}
  if(!inventoryQaAllowed(config))return {ok:false,error:{code:'FORBIDDEN',message:'로컬 QA는 명시적으로 활성화한 개발 실행에서만 사용할 수 있습니다.',retryable:false}};
  if(args.length)return {ok:false,error:{code:'INVALID_INPUT',message:'연결 주소나 자격정보를 지정할 수 없습니다.',retryable:false}};
  if(busy)return {ok:false,error:{code:'CONFLICT',message:'연결 상태 확인 중입니다.',retryable:false}};
  busy=true;
  try{const reachable=await probe();assertSender(event,contents,url);return {ok:true,data:{mode:'local-qa',authGateway:reachable?'reachable':'unavailable',inventoryConnection:'blocked',persisted:false}};}
  catch{return {ok:false,error:{code:'INTERNAL_ERROR',message:'연결 상태를 확인하지 못했습니다.',retryable:true}};}
  finally{busy=false;}
 };
}
