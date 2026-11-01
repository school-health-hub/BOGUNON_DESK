import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { IpcResult, PurchaseCsvSelection, PurchaseCsvMappingRequest } from '../protocol.js';
import { assertSender } from './policy.js';
import { analyzeCsv, CSV_LIMITS, parseMappedRows } from './purchase-csv.js';
export const readSelectedCsv=(path:string)=>readSelectedPurchaseFile(path,['.csv']);
export async function readSelectedPurchaseFile(path:string,extensions:readonly string[]):Promise<Uint8Array>{
 if(!extensions.includes(extname(path).toLowerCase()))throw Error('CSV 파일만 선택해 주세요.');
 const selected=await lstat(path);
 if(!selected.isFile()||selected.isSymbolicLink()||selected.size>CSV_LIMITS.bytes)throw Error('일반 CSV 파일만 선택해 주세요.');
 const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{
  const before=await file.stat();if(!before.isFile()||before.ino!==selected.ino||before.dev!==selected.dev||before.size>CSV_LIMITS.bytes)throw Error('CSV 파일 크기 또는 형식을 확인해 주세요.');
  const bytes=Buffer.alloc(Math.min(before.size+1,CSV_LIMITS.bytes+1));let offset=0;
  while(offset<bytes.length){const {bytesRead}=await file.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)break;offset+=bytesRead;}
  const after=await file.stat();
  if(offset!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw Error('읽는 중 파일이 변경되었습니다.');
  return bytes.subarray(0,offset);
 }finally{await file.close();}
}
const failure=(code:'INVALID_INPUT'|'FORBIDDEN'|'INTERNAL_ERROR',message:string)=>({ok:false as const,error:{code,message,retryable:code==='INTERNAL_ERROR'}});
export function createPurchaseImportHandlers(contents:Parameters<typeof assertSender>[1],url:string,select:()=>Promise<string|undefined>,read=readSelectedCsv){
 let generation=0,picking=false,current:PurchaseCsvSelection|undefined;
 const allowed=(event:Parameters<typeof assertSender>[0])=>{try{assertSender(event,contents,url);return true;}catch{return false;}};
 return {
  pick:async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<PurchaseCsvSelection|null>>=>{
   if(!allowed(event))return failure('FORBIDDEN','허용되지 않은 호출입니다.');
   if(args.length)return failure('INVALID_INPUT','파일 선택에는 경로를 전달할 수 없습니다.');
   if(picking)return failure('INVALID_INPUT','이미 CSV 선택이 진행 중입니다.');
   picking=true;const token=++generation;current=undefined;
   try{
    const path=await select();
    if(token!==generation||!allowed(event)||!path)return {ok:true,data:null};
    const bytes=await read(path);
    if(token!==generation||!allowed(event))return {ok:true,data:null};
    const result=analyzeCsv(bytes,basename(path));
    current={generation:token,result};return {ok:true,data:current};
   }catch{return token!==generation?{ok:true,data:null}:failure('INVALID_INPUT','CSV를 분석하지 못했습니다. 인코딩·수식·형식 및 15 MiB/530행/256열/500품목 제한을 확인해 주세요.');}
   finally{picking=false;}
  },
  cancel:async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<null>>=>{
   if(!allowed(event))return failure('FORBIDDEN','허용되지 않은 호출입니다.');
   if(args.length)return failure('INVALID_INPUT','잘못된 취소 요청입니다.');
   ++generation;current=undefined;return {ok:true,data:null};
  },
  map:async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<PurchaseCsvSelection>>=>{
   if(!allowed(event))return failure('FORBIDDEN','허용되지 않은 호출입니다.');
   try{
    if(args.length!==1||!args[0]||typeof args[0]!=='object'||Array.isArray(args[0]))throw Error();
    const r=args[0] as PurchaseCsvMappingRequest;
    if(Object.keys(r).sort().join(',')!=='candidateId,generation,headerRow,mapping'||!current||r.generation!==generation||!r.mapping||typeof r.mapping!=='object'||Array.isArray(r.mapping))throw Error();
    const candidate=current.result.candidates.find(c=>c.id===r.candidateId);
    if(!candidate||!candidate.headerOptions.some(o=>o.rowIndex===r.headerRow))throw Error();
    const items=parseMappedRows(candidate.rows,candidate.sourceName,r.headerRow,r.mapping);
    if(!items.length)throw Error();
    current={generation,result:{items,sources:[{sourceName:candidate.sourceName,status:'success',rowCount:items.length,message:null}],candidates:[]}};
    return {ok:true,data:current};
   }catch{return failure('INVALID_INPUT','열 연결 또는 분석 상태가 변경되었습니다. CSV를 다시 선택해 주세요.');}
  },
 };
}
