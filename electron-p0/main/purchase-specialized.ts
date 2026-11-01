import {assertSender} from './policy.js';import {validateSpecialOutput,type SpecialOutput} from './purchase-specialized-validation.js';import type {ExcelService} from './purchase-excel.js';import type {IpcResult,PurchaseTable} from '../protocol.js';
export function createSpecialPreview(contents:Parameters<typeof assertSender>[1],url:string,kind:'settlement'|'edufine',service:Pick<ExcelService,'previewSpecial'>){
 let token=0,controller:AbortController|undefined;
 return {dispose:()=>{token++;controller?.abort();},handle:async(e:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<PurchaseTable>>=>{
  try{assertSender(e,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 호출입니다.',retryable:false}};}
  let request:SpecialOutput;try{if(args.length!==1)throw Error();request=validateSpecialOutput(args[0],kind,false);}catch{return {ok:false,error:{code:'INVALID_INPUT',message:'선택 품목·실제 수량·금액·세액 구분을 확인해 주세요.',retryable:false}};}
  const current=++token;controller?.abort();controller=new AbortController();
  try{const result=await service.previewSpecial(request,controller.signal);assertSender(e,contents,url);if(current!==token)throw Error();return {ok:true,data:result};}catch{return {ok:false,error:{code:'CONFLICT',message:'미리보기 결과가 오래되었거나 준비하지 못했습니다. 다시 확인해 주세요.',retryable:true}};}
 }};
}
