import {assertSender} from './policy.js';
import type {IpcResult,PurchaseCsvSelection,PurchaseCsvMappingRequest} from '../protocol.js';
import type {ExcelService} from './purchase-excel.js';
export function createExcelHandlers(contents:Parameters<typeof assertSender>[1],url:string,select:()=>Promise<string|undefined>,service:Pick<ExcelService,'analyze'|'map'>,label='Excel'){
 let generation=0,current:PurchaseCsvSelection|undefined,controller:AbortController|undefined,picking=false;
 const allowed=(e:Parameters<typeof assertSender>[0])=>{try{assertSender(e,contents,url);return true;}catch{return false;}};
 const fail=(code:'FORBIDDEN'|'INVALID_INPUT'|'INTERNAL_ERROR'):IpcResult<never>=>({ok:false,error:{code,message:code==='FORBIDDEN'?'허용되지 않은 호출입니다.':`${label} 분석을 완료하지 못했습니다. 기존 품목을 보존했습니다.`,retryable:code==='INTERNAL_ERROR'}});
 const cancel=()=>{generation++;current=undefined;controller?.abort();};
 return {
  dispose:cancel,
  pick:async(e:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<PurchaseCsvSelection|null>>=>{
   if(!allowed(e))return fail('FORBIDDEN');if(args.length||picking)return fail('INVALID_INPUT');
   cancel();const token=generation;controller=new AbortController();const signal=controller.signal;picking=true;
   try{
    const path=await select();if(!path||token!==generation||!allowed(e))return {ok:true,data:null};
    const result=await service.analyze(path,signal);
    if(token!==generation||!allowed(e))return {ok:true,data:null};
    current={generation:token,result};return {ok:true,data:current};
   }catch{return token!==generation?{ok:true,data:null}:fail('INTERNAL_ERROR');}finally{picking=false;}
  },
  cancel:async(e:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<null>>=>{if(!allowed(e))return fail('FORBIDDEN');if(args.length)return fail('INVALID_INPUT');cancel();return {ok:true,data:null};},
  map:async(e:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<PurchaseCsvSelection>>=>{
   if(!allowed(e))return fail('FORBIDDEN');
   const token=generation;
   try{
    const r=args[0] as PurchaseCsvMappingRequest;
    if(args.length!==1||!r||Object.keys(r).sort().join(',')!=='candidateId,generation,headerRow,mapping'||r.generation!==generation||!current||!r.mapping||typeof r.mapping!=='object'||Array.isArray(r.mapping))return fail('INVALID_INPUT');
    const c=current.result.candidates.find(c=>c.id===r.candidateId);
    if(!c||!c.headerOptions.some(o=>o.rowIndex===r.headerRow))return fail('INVALID_INPUT');
    // Consume the candidate before awaiting: concurrent/repeated mappings cannot reuse it.
    current=undefined;controller?.abort();controller=new AbortController();
    const result=await service.map(c,r.headerRow,r.mapping,controller.signal);
    if(token!==generation||!allowed(e))return fail('INVALID_INPUT');current={generation:token,result};return {ok:true,data:current};
   }catch{return fail('INTERNAL_ERROR');}
  },
 };
}
