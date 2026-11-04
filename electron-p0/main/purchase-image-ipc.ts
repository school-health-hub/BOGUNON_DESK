import {mkdtemp,lstat,open,writeFile,rm,readFile} from 'node:fs/promises';
import {basename,extname,isAbsolute,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {processingSettings,previewRegion,ocrOptions} from './purchase-image-preview.js';
import {assertSender} from './policy.js';
import {imageDimensions} from './purchase-image-files.js';
import {IMAGE_IMPORT_LIMITS as LIMIT,type ImageSelection,type ImageAnalysis,type OcrLine,type ImageOcrOptions,type ImageBox,type ImagePreview} from '../purchase-image-protocol.js';
import type {IpcResult} from '../protocol.js';
type Event=Parameters<typeof assertSender>[0];
type Owned=ImageSelection&{root:string;paths:readonly string[];controller:AbortController;result?:ImageAnalysis;resultKey?:string;previewWork?:Promise<void>;running?:Promise<IpcResult<ImageAnalysis|null>>};
type Decoder=(bytes:Buffer)=>{width:number;height:number;png:Buffer;thumbnail:string;perceptualHash?:string};
export function createImageImportHandlers(contents:Parameters<typeof assertSender>[1],url:string,deps:{select:()=>Promise<readonly string[]|undefined>;tempRoot:string;decode:Decoder;recognize:(path:string,signal:AbortSignal,options?:ImageOcrOptions)=>Promise<readonly OcrLine[]>;ready:()=>Promise<void>;onInvalidate?:()=>void;preview?:(bytes:Buffer,region:ImageBox)=>string}){
 let generation=0,picking=false,current:Owned|undefined,pickingWork:Promise<void>|undefined;const cleanup=new Set<Promise<void>>();
 const allowed=(e:Event)=>{try{assertSender(e,contents,url);return true;}catch{return false;}};
 const fail=(code:'FORBIDDEN'|'INVALID_INPUT'|'INTERNAL_ERROR',message='이미지를 분석하지 못했습니다. 기존 구매 품목은 보존했습니다.'):IpcResult<never>=>({ok:false,error:{code,message,retryable:code==='INTERNAL_ERROR'}});
 const dispose=()=>{deps.onInvalidate?.();generation++;const old=current;current=undefined;if(old){old.controller.abort();const task=Promise.all([old.running,old.previewWork]).catch(()=>{}).then(()=>rm(old.root,{recursive:true,force:true,maxRetries:3,retryDelay:100})).catch(()=>{});cleanup.add(task);void task.finally(()=>cleanup.delete(task));}};
 return {dispose,
  isCurrent:(token:string)=>current?.token===token,
  readSource:async(token:string,sourceId:string)=>{
   const owned=current,gen=generation;if(!owned||owned.token!==token||owned.running||owned.previewWork)throw Error('Invalid image session');const index=owned.sources.findIndex(s=>s.id===sourceId);if(index<0)throw Error('Invalid source');
   let done!:()=>void;owned.previewWork=new Promise<void>(resolve=>{done=resolve;});
   try{const meta=await lstat(owned.paths[index]);if(!meta.isFile()||meta.isSymbolicLink()||meta.size>48*1024*1024)throw Error('Invalid source');const bytes=await readFile(owned.paths[index]);if(bytes.length>48*1024*1024||gen!==generation)throw Error('Stale source');return {source:owned.sources[index],bytes};}finally{done();owned.previewWork=undefined;}
  },flush:async()=>{await Promise.all([pickingWork,...cleanup]);},
  cancel:async(e:Event,...args:unknown[]):Promise<IpcResult<null>>=>{if(!allowed(e))return fail('FORBIDDEN');if(args.length)return fail('INVALID_INPUT');dispose();return {ok:true,data:null};},
  pick:async(e:Event,...args:unknown[]):Promise<IpcResult<ImageSelection|null>>=>{
   if(!allowed(e))return fail('FORBIDDEN');if(args.length||picking)return fail('INVALID_INPUT');dispose();picking=true;let finish!:()=>void;const operation=new Promise<void>(resolve=>{finish=resolve;});pickingWork=operation;const gen=generation;let root:string|undefined;
   try{
    if(gen!==generation)return {ok:true,data:null};
    const selected=await deps.select();if(gen!==generation||!allowed(e)||!selected?.length)return {ok:true,data:null};
    if(selected.length>LIMIT.files)throw Error('최대 10장까지 선택할 수 있습니다.');
    root=await mkdtemp(join(deps.tempRoot,'bogunon-purchase-images-'));const sources=[],paths=[];let total=0;
    for(const [order,path] of selected.entries()){
     if(gen!==generation||!allowed(e))return {ok:true,data:null};
     if(!isAbsolute(path)||path.startsWith('\\\\')||!['.png','.jpg','.jpeg'].includes(extname(path).toLowerCase()))throw Error('로컬 JPG/JPEG/PNG 파일만 선택해 주세요.');
     const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||before.size>LIMIT.bytes||before.size<24)throw Error('파일은 장당 10MiB 이하의 일반 이미지여야 합니다.');
     const handle=await open(path,'r');let bytes:Buffer;
     try{const stat=await handle.stat();if(stat.dev!==before.dev||stat.ino!==before.ino||stat.size!==before.size)throw Error('선택한 파일이 변경되었습니다.');bytes=Buffer.alloc(stat.size);let offset=0;while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)throw Error('이미지를 읽지 못했습니다.');offset+=bytesRead;}const after=await handle.stat();if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw Error('분석 중 원본 이미지가 변경되었습니다.');}finally{await handle.close();}
     const header=imageDimensions(bytes),decoded=deps.decode(bytes);if(!((decoded.width===header.width&&decoded.height===header.height)||(decoded.width===header.height&&decoded.height===header.width))||!decoded.png.length||decoded.png.length>48*1024*1024||!/^data:image\/png;base64,/.test(decoded.thumbnail)||decoded.thumbnail.length>120000)throw Error('손상되었거나 너무 큰 이미지입니다.');
     total+=decoded.png.length;if(total>LIMIT.batchBytes)throw Error('선택 이미지의 전체 메모리 제한을 초과했습니다.');
     const id=randomUUID(),owned=join(root,id+'.png');await writeFile(owned,decoded.png,{flag:'wx',mode:0o600});paths.push(owned);
     sources.push({id,order:order+1,name:basename(path).replace(/[\x00-\x1f]/g,'').slice(0,160),width:decoded.width,height:decoded.height,thumbnail:decoded.thumbnail,sha256:createHash('sha256').update(bytes).digest('hex'),...(decoded.perceptualHash&&/^[a-f0-9]{16}$/.test(decoded.perceptualHash)?{perceptualHash:decoded.perceptualHash}:{}),warning:header.width<600?'작은 이미지입니다. 인식 결과를 자세히 확인해 주세요.':null});
    }
    if(gen!==generation||!allowed(e))return {ok:true,data:null};
    current={token:randomUUID(),sources,root,paths,controller:new AbortController()};root=undefined;return {ok:true,data:{token:current.token,sources:current.sources}};
   }catch(error){return gen!==generation?{ok:true,data:null}:fail('INVALID_INPUT',error instanceof Error&&/^(최대|로컬 |파일은|선택한 |분석 중|손상|선택 이미지|이미지를|PNG\/JPEG|오프라인)/.test(error.message)?error.message:'이미지 파일을 읽거나 검증하지 못했습니다. 기존 품목은 유지합니다.');}
   finally{try{if(root)await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}finally{picking=false;finish();if(pickingWork===operation)pickingWork=undefined;}}
  },
  preview:async(e:Event,...args:unknown[]):Promise<IpcResult<ImagePreview|null>>=>{
   if(!allowed(e))return fail('FORBIDDEN');const r=args[0] as {token?:unknown;sourceId?:unknown;region?:unknown};
   if(args.length!==1||!r||typeof r!=='object'||!['sourceId,token','region,sourceId,token'].includes(Object.keys(r).sort().join(','))||!current||r.token!==current.token||!deps.preview||current.previewWork||current.running)return fail('INVALID_INPUT');
   const owned=current,gen=generation,index=owned.sources.findIndex(s=>s.id===r.sourceId);if(index<0)return fail('INVALID_INPUT');const source=owned.sources[index];let region:ImageBox;
   try{region=previewRegion(r.region,source.width,source.height);}catch{return fail('INVALID_INPUT');}
   let done!:()=>void;owned.previewWork=new Promise<void>(resolve=>{done=resolve;});
   try{const stat=await lstat(owned.paths[index]);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>48*1024*1024)throw Error('Invalid preview');const bytes=await readFile(owned.paths[index]);if(bytes.length>48*1024*1024)throw Error('Invalid preview');const dataUrl=deps.preview(bytes,region);if(!/^data:image\/png;base64,/.test(dataUrl)||dataUrl.length>4*1024*1024)throw Error('Invalid preview');if(gen!==generation||!allowed(e))return {ok:true,data:null};return {ok:true,data:{sourceId:source.id,region,dataUrl}};}
   catch{return gen!==generation?{ok:true,data:null}:fail('INTERNAL_ERROR','원본 보기를 완료하지 못했습니다. 기존 품목은 유지합니다.');}finally{done();owned.previewWork=undefined;}
  },
  analyze:async(e:Event,...args:unknown[]):Promise<IpcResult<ImageAnalysis|null>>=>{
   if(!allowed(e))return fail('FORBIDDEN');const request=args[0] as {token?:unknown;settings?:unknown};
   if(args.length!==1||!request||typeof request!=='object'||!['token','settings,token'].includes(Object.keys(request).sort().join(','))||!current||request.token!==current.token)return fail('INVALID_INPUT');
   const owned=current,gen=generation;let settings;try{settings=processingSettings(request.settings,owned.sources);}catch{return fail('INVALID_INPUT');}const resultKey=JSON.stringify(settings);if(owned.running)return fail('INVALID_INPUT');if(owned.result&&owned.resultKey===resultKey)return {ok:true,data:owned.result};owned.result=undefined;owned.controller=new AbortController();
   const run=async():Promise<IpcResult<ImageAnalysis|null>>=>{try{await deps.ready();}catch{return fail('INTERNAL_ERROR','오프라인 OCR 구성파일을 찾거나 검증하지 못했습니다. 앱 패키지를 확인해 주세요.');}const timer=setTimeout(()=>owned.controller.abort(),LIMIT.batchMs);try{
    const results=[];
    for(const [i,path] of owned.paths.entries()){
     if(gen!==generation||!allowed(e))return {ok:true,data:null};if(owned.controller.signal.aborted)throw Error('이미지 분석 시간 제한을 초과했습니다.');
     try{const lines=await deps.recognize(path,owned.controller.signal,ocrOptions(settings[i]));results.push({sourceId:owned.sources[i].id,status:'success' as const,lines,processing:ocrOptions(settings[i]),message:lines.length?null:'읽을 수 있는 텍스트가 없습니다. 직접 검토해 주세요.'});}
     catch{if(owned.controller.signal.aborted)throw Error('이미지 분석이 중단되었습니다.');results.push({sourceId:owned.sources[i].id,status:'error' as const,lines:[],message:'이 이미지의 OCR을 완료하지 못했습니다. 다른 이미지 결과는 유지합니다.'});}
    }
    if(gen!==generation||!allowed(e))return {ok:true,data:null};owned.result={token:owned.token,results};owned.resultKey=resultKey;return {ok:true,data:owned.result};
   }catch{return gen!==generation?{ok:true,data:null}:fail('INTERNAL_ERROR');}finally{clearTimeout(timer);}};
   owned.running=run();try{return await owned.running;}finally{owned.running=undefined;}
  },
 };
}
