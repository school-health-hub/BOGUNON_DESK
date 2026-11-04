import {isAbsolute,relative,sep,extname} from 'node:path';
import type {EducationVideoFileExportResult,IpcResult} from '../protocol.js';
import {assertSender} from './policy.js';
import {validateLibraryV2} from './finder-v2/validate.js';
import {EducationVideoLibraryStore,validateEducationVideoLibrary} from './education-video-library.js';
import {writeSelectedExport,ExportConflict} from './purchase-export-storage.js';

// Renderer supplies no JSON or paths: Main exports only its validated, isolated library.
export function createEducationVideoExport(contents:Parameters<typeof assertSender>[1],url:string,store:EducationVideoLibraryStore,ports:{version?:1|2;protectedRoot:string;pick:()=>Promise<string|undefined>;confirm:()=>Promise<boolean>;write?:typeof writeSelectedExport}){
 let pending:Promise<IpcResult<EducationVideoFileExportResult>>|undefined,disposed=false;
 const abort=new AbortController();
 const waitDialog=<T>(operation:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{
  const cancel=()=>reject(Error('Closed export'));if(abort.signal.aborted){cancel();return;}
  abort.signal.addEventListener('abort',cancel,{once:true});
  operation.then(value=>{abort.signal.removeEventListener('abort',cancel);resolve(value);},error=>{abort.signal.removeEventListener('abort',cancel);reject(error);});
 });
 const failure=(code:'FORBIDDEN'|'INVALID_INPUT'|'STORAGE_ERROR'|'CONFLICT'):IpcResult<never>=>({ok:false,error:{code,message:code==='FORBIDDEN'?'허용되지 않은 호출입니다.':code==='INVALID_INPUT'?'내보내기는 파일 경로나 데이터를 입력받지 않습니다.':code==='CONFLICT'?'선택한 파일이 변경되어 저장하지 않았습니다. 기존 라이브러리는 유지됩니다.':'라이브러리 JSON을 저장하지 못했습니다. 기존 파일과 라이브러리는 유지됩니다.',retryable:code==='STORAGE_ERROR'||code==='CONFLICT'}});
 const fresh=(event:Parameters<typeof assertSender>[0])=>{assertSender(event,contents,url);if(disposed)throw Error('Closed export');};
 return {
  dispose:()=>{disposed=true;abort.abort();},flush:async()=>{await pending;},
  handle:(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<EducationVideoFileExportResult>>=>{
   try{fresh(event);}catch{return Promise.resolve(failure('FORBIDDEN'));}
   if(args.length)return Promise.resolve(failure('INVALID_INPUT'));
   if(pending)return Promise.resolve(failure('STORAGE_ERROR'));
   const task=async():Promise<IpcResult<EducationVideoFileExportResult>>=>{
    try{
     const library=ports.version===2?validateLibraryV2(JSON.parse(await store.exportV2())):validateEducationVideoLibrary(JSON.parse(await store.export()));
     let json=JSON.stringify(library,null,2);
     // Preserve importability for valid libraries near the existing size limit.
     if(Buffer.byteLength(json)>2*1024*1024)json=JSON.stringify(library);
     if(Buffer.byteLength(json)>2*1024*1024)throw Error('Export exceeds import limit');
     fresh(event);const path=await waitDialog(ports.pick());fresh(event);if(!path)return {ok:true,data:{status:'canceled'}};
     // Never allow an export to replace app settings, the library, or its backup.
     const rel=relative(ports.protectedRoot,path);
     if(!isAbsolute(path)||extname(path).toLowerCase()!=='.json'||(!rel||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!isAbsolute(rel))))throw Error('Unsafe output target');
     const data=await (ports.write??writeSelectedExport)(path,'json',Buffer.from(json,'utf8'),async()=>{fresh(event);const yes=await waitDialog(ports.confirm());fresh(event);return yes;},()=>fresh(event));
     return {ok:true,data};
    }catch(error){if(disposed)return {ok:true,data:{status:'canceled'}};return failure(error instanceof ExportConflict?'CONFLICT':'STORAGE_ERROR');}
   };
   pending=task().finally(()=>{pending=undefined;});return pending;
  },
 };
}
