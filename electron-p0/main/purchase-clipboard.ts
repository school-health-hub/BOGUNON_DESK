import type { IpcResult, PurchaseClipboardRequest } from '../protocol.js';
import { assertSender } from './policy.js';
export function validatePurchaseClipboard(value:unknown):PurchaseClipboardRequest {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid request');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='html,text'||typeof v.text!=='string'||typeof v.html!=='string'||!v.text.trim()||v.text.length>500_000||v.html.length>1_000_000||v.text.includes('\0')||v.html.includes('\0'))throw Error('Invalid content');
 // Source generators escape all input and emit only these attribute-free table/paragraph tags.
 if(v.html.replace(/<\/?(?:table|thead|tbody|tr|th|td|p)>|<br>/g,'').includes('<'))throw Error('Invalid HTML');
 return {text:v.text,html:v.html};
}
export function createPurchaseClipboardHandler(contents:Parameters<typeof assertSender>[1],url:string,write:(content:PurchaseClipboardRequest)=>void|Promise<void>) {
 return async (event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<null>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 호출입니다.',retryable:false}};}
  let content:PurchaseClipboardRequest;
  try{if(args.length!==1)throw Error('Invalid arity');content=validatePurchaseClipboard(args[0]);}catch{return {ok:false,error:{code:'INVALID_INPUT',message:'복사할 내용과 크기를 확인해 주세요.',retryable:false}};}
  try{await write(content);return {ok:true,data:null};}catch{return {ok:false,error:{code:'INTERNAL_ERROR',message:'클립보드에 복사하지 못했습니다.',retryable:true}};}
 };
}
