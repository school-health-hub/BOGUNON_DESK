import type {IpcResult} from '../protocol.js';
import type {WorkFoldersLoad,StoredWorkFolder} from '../work-folders-protocol.js';
import {assertSender} from './policy.js';
import {FolderError,folderId,folderName,inspectLocalFolder,newFolder,WorkFoldersStore,displayFolderPath} from './work-folders.js';
export function validateMemoUrl(input:unknown):string{
 if(typeof input!=='string'||!input.trim()||input.length>8192||/[\u0000-\u0020\u007f\\]/.test(input.trim())||!/^https?:\/\//i.test(input.trim()))throw new FolderError('INVALID_INPUT','http 또는 https 주소를 확인해 주세요.');
 let url:URL;try{url=new URL(input.trim());}catch{throw new FolderError('INVALID_INPUT','올바른 웹 주소를 입력해 주세요.');}
 if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw new FolderError('INVALID_INPUT','인증정보가 없는 http 또는 https 주소만 열 수 있습니다.');return url.href;
}
type Event=Parameters<typeof assertSender>[0];
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function createWorkFolderHandlers(contents:Parameters<typeof assertSender>[1],url:string,store:WorkFoldersStore,ports:{pick:()=>Promise<string|undefined>;openPath:(path:string)=>Promise<string>;openExternal:(url:string)=>Promise<void>;confirmRemove:(name:string)=>Promise<boolean>;inspect?:(path:string)=>Promise<string>}){
 let disposed=false,picking=false;const inspect=ports.inspect??inspectLocalFolder;
 const fresh=(event:Event)=>{assertSender(event,contents,url);if(disposed)throw new FolderError('FORBIDDEN','종료된 요청입니다.');};
 const view=async(result:Awaited<ReturnType<WorkFoldersStore['load']>>):Promise<WorkFoldersLoad>=>({version:1,revision:result.document.revision,recovered:result.recovered,favorites:await Promise.all(result.document.favorites.map(async f=>{try{await inspect(f.path);return {...f,displayPath:displayFolderPath(f.path),available:true};}catch(e){return {...f,displayPath:displayFolderPath(f.path),available:false,unavailableReason:e instanceof FolderError?e.message:'폴더에 접근할 수 없습니다.'};}}))});
 const run=<T>(count:number,task:(args:unknown[],event:Event)=>Promise<T>)=>async(event:Event,...args:unknown[]):Promise<IpcResult<T>>=>{
  try{fresh(event);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 폴더·링크 요청입니다.',retryable:false}};}
  try{if(args.length!==count)throw new FolderError('INVALID_INPUT','요청 형식을 확인해 주세요.');return {ok:true,data:await task(args,event)};}
  catch(e){return {ok:false,error:{code:e instanceof FolderError?(e.code==='NOT_FOUND'?'INVALID_INPUT':e.code):'STORAGE_ERROR',message:e instanceof FolderError?e.message:'작업을 완료하지 못했습니다. 기존 폴더 목록·메모를 보존합니다.',retryable:!(e instanceof FolderError&&['INVALID_INPUT','FORBIDDEN'].includes(e.code))}};}
 };
 const request=(v:unknown,keys:string[])=>{if(!exact(v,keys)||!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0||Number(v.expectedRevision)>=Number.MAX_SAFE_INTEGER)throw new FolderError('INVALID_INPUT','폴더 요청·revision을 확인해 주세요.');return v;};
 const find=(items:readonly StoredWorkFolder[],id:unknown)=>{if(!folderId(id))throw new FolderError('INVALID_INPUT','폴더 ID를 확인해 주세요.');const f=items.find(f=>f.id===id);if(!f)throw new FolderError('NOT_FOUND','등록된 폴더를 찾지 못했습니다. 다시 불러와 주세요.');return f;};
 return {
  load:run(0,async()=>view(await store.load())),
  pick:run(1,async(args,event)=>{
   const r=request(args[0],['expectedRevision']);if(picking)throw new FolderError('CONFLICT','폴더 선택이 진행 중입니다.');picking=true;
   try{const selected=await ports.pick();fresh(event);if(!selected)return null;const path=await inspect(selected);fresh(event);return view(await store.mutate(Number(r.expectedRevision),items=>{
    fresh(event);if(items.length>=12)throw new FolderError('INVALID_INPUT','업무 폴더는 최대 12개까지 등록할 수 있습니다.');const key=(v:string)=>process.platform==='win32'?v.toLowerCase():v;if(items.some(f=>key(f.path)===key(path)))throw new FolderError('CONFLICT','이미 등록된 폴더입니다.');return [...items,newFolder(path)];
   }));}finally{picking=false;}
  }),
  rename:run(1,async(args,event)=>{const r=request(args[0],['expectedRevision','id','name']),name=folderName(r.name);return view(await store.mutate(Number(r.expectedRevision),items=>{fresh(event);find(items,r.id);return items.map(f=>f.id===r.id?{...f,name}:f);}));}),
  remove:run(1,async(args,event)=>{const r=request(args[0],['expectedRevision','id','confirmed']);if(r.confirmed!==true)throw new FolderError('INVALID_INPUT','등록 해제 확인이 필요합니다.');const current=await store.load(),f=find(current.document.favorites,r.id);if(!await ports.confirmRemove(f.name))return null;fresh(event);return view(await store.mutate(Number(r.expectedRevision),items=>{fresh(event);find(items,r.id);return items.filter(f=>f.id!==r.id);}));}),
  reorder:run(1,async(args,event)=>{const r=request(args[0],['expectedRevision','ids']);if(!Array.isArray(r.ids)||r.ids.length>12||r.ids.some(id=>!folderId(id))||new Set(r.ids).size!==r.ids.length)throw new FolderError('INVALID_INPUT','폴더 순서를 확인해 주세요.');const ids=r.ids as string[];return view(await store.mutate(Number(r.expectedRevision),items=>{fresh(event);if(ids.length!==items.length)throw new FolderError('INVALID_INPUT','전체 폴더 순서를 전달해 주세요.');return ids.map(id=>find(items,id));}));}),
  open:run(1,async(args,event)=>{if(!exact(args[0],['id']))throw new FolderError('INVALID_INPUT','등록된 ID로만 폴더를 열 수 있습니다.');const f=find((await store.load()).document.favorites,args[0].id),path=await inspect(f.path);fresh(event);try{if(await ports.openPath(path))throw Error();}catch{throw new FolderError('INTERNAL_ERROR','탐색기에서 폴더를 열지 못했습니다. 접근 권한·이동된 경로를 확인해 주세요.');}return null;}),
  openMemoUrl:run(1,async(args,event)=>{if(!exact(args[0],['url']))throw new FolderError('INVALID_INPUT','웹 주소를 확인해 주세요.');const target=validateMemoUrl(args[0].url);fresh(event);try{await ports.openExternal(target);}catch{throw new FolderError('INTERNAL_ERROR','기본 브라우저로 링크를 열지 못했습니다. 브라우저 설정을 확인해 주세요.');}return null;}),
  dispose:()=>{disposed=true;},
 };
}
