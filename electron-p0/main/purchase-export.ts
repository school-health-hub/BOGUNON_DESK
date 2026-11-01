import type {IpcResult,PurchaseExportResult,PurchaseExportRequest} from '../protocol.js';
import {assertSender} from './policy.js';
import {validatePurchaseExport,purchaseExportSummary} from './purchase-export-validation.js';
import {writePurchaseExport,ExportConflict} from './purchase-export-storage.js';
function dialogResult<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{const cancel=()=>reject(Error('Canceled'));if(signal.aborted){cancel();return;}signal.addEventListener('abort',cancel,{once:true});operation.then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});});
}
export function createPurchaseExportHandler<T extends {format:'csv'|'xlsx'}=PurchaseExportRequest>(contents:Parameters<typeof assertSender>[1],url:string,ports:{review:(summary:string)=>Promise<boolean>;generate:(request:T,signal:AbortSignal)=>Promise<Buffer>;pick:(format:'csv'|'xlsx',request:T)=>Promise<string|undefined>;confirm:()=>Promise<boolean>;write?:typeof writePurchaseExport},contract?:{validate:(value:unknown)=>T;summary:(request:T)=>string}){
 let pending:Promise<IpcResult<PurchaseExportResult>>|undefined,controller:AbortController|undefined;
 const failure=(code:'FORBIDDEN'|'INVALID_INPUT'|'STORAGE_ERROR'|'CONFLICT'):IpcResult<never>=>({ok:false,error:{code,message:code==='FORBIDDEN'?'허용되지 않은 호출입니다.':code==='INVALID_INPUT'?'선택 품목·수량·단가·금액·출력 열을 확인해 주세요.':code==='CONFLICT'?'저장할 파일이 변경되어 덮어쓰지 않았습니다. 다시 선택해 주세요.':'파일을 저장하지 못했습니다. 기존 파일은 보존했습니다.',retryable:code!=='FORBIDDEN'&&code!=='INVALID_INPUT'}});
 const allowed=(event:Parameters<typeof assertSender>[0])=>{try{assertSender(event,contents,url);return true;}catch{return false;}};
 return {
  dispose:()=>controller?.abort(),flush:async()=>{await pending;},
  handle:(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<PurchaseExportResult>>=>{
   if(!allowed(event))return Promise.resolve(failure('FORBIDDEN'));
   let request:T;try{if(args.length!==1)throw Error();request=(contract?.validate??validatePurchaseExport)(args[0]) as T;}catch{return Promise.resolve(failure('INVALID_INPUT'));}
   if(pending)return Promise.resolve(failure('STORAGE_ERROR'));
   controller=new AbortController();const signal=controller.signal;const fresh=()=>{if(signal.aborted||!allowed(event))throw Error('Canceled');};
   const task=async():Promise<IpcResult<PurchaseExportResult>>=>{
    try{
     fresh();if(!await dialogResult(ports.review((contract?contract.summary(request):purchaseExportSummary(request as unknown as PurchaseExportRequest))),signal))return {ok:true,data:{status:'canceled'}};
     fresh();const bytes=await ports.generate(request,signal);fresh();
     const path=await dialogResult(ports.pick(request.format,request),signal);fresh();if(!path)return {ok:true,data:{status:'canceled'}};
     const data=await (ports.write??writePurchaseExport)(path,request.format,bytes,()=>dialogResult(ports.confirm(),signal),fresh);return {ok:true,data};
    }catch(e){if(signal.aborted||!allowed(event))return {ok:true,data:{status:'canceled'}};return failure(e instanceof ExportConflict?'CONFLICT':'STORAGE_ERROR');}
   };
   pending=task().finally(()=>{pending=undefined;});return pending;
  },
 };
}
