import {Worker} from 'node:worker_threads';
import {open,lstat} from 'node:fs/promises';
import {dirname,extname,isAbsolute,relative,sep} from 'node:path';
import {assertSender} from './policy.js';
import {safeParents,stampDimensions,InstructorStampStore} from './instructor-stamp.js';
import {writeSelectedExport} from './purchase-export-storage.js';
import type {FileResult,InstructorFilesRequest} from '../instructor-files-protocol.js';
interface Board {version:number;instructor:{id:string}|null;logs:unknown[]}
interface State {phase:string;board?:Board}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const monthValue=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(v))throw Error('input');};
export interface InstructorFilePorts {
 authorize(school:string):Promise<{user:string;generation:number}>;
 board(school:string,month:string):Promise<State>;
 stamp:InstructorStampStore;protectedRoot:string;
 pick(kind:'stamp'|'workbook'):Promise<string|undefined>;save(month:string):Promise<string|undefined>;
 confirm(message:string):Promise<boolean>;decode(bytes:Buffer):Buffer;
 print():Promise<boolean>;
 worker?<T>(data:unknown,signal?:AbortSignal):Promise<T>;
}
function worker<T>(workerData:unknown,signal?:AbortSignal):Promise<T>{return new Promise((resolve,reject)=>{const w=new Worker(new URL('./instructor-workbook-worker.js',import.meta.url),{workerData,resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16}});const stop=()=>{void w.terminate();reject(Error('closed'));};signal?.addEventListener('abort',stop,{once:true});const timer=setTimeout(()=>{void w.terminate();reject(Error('timeout'));},5000);w.once('message',v=>{clearTimeout(timer);void w.terminate();resolve(v);});w.once('error',()=>{clearTimeout(timer);reject(Error('workbook'));});w.once('exit',code=>{signal?.removeEventListener('abort',stop);clearTimeout(timer);if(code!==0)reject(Error('workbook'));});});}
export async function readInstructorFile(path:string,max:number,extensions:string[]){
 if(!isAbsolute(path)||path.startsWith('\\\\')||!extensions.includes(extname(path).toLowerCase()))throw Error('file');await safeParents(dirname(path));
 const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||before.size>max)throw Error('file');const f=await open(path,'r');try{const s=await f.stat();if(s.dev!==before.dev||s.ino!==before.ino)throw Error('changed');const b=Buffer.alloc(s.size);let n=0;while(n<b.length){const r=await f.read(b,n,b.length-n,n);if(!r.bytesRead)throw Error('changed');n+=r.bytesRead;}const after=await f.stat();if(after.size!==s.size||after.mtimeMs!==s.mtimeMs||after.ctimeMs!==s.ctimeMs)throw Error('changed');return b;}finally{await f.close();}
}
export function createInstructorFiles(contents:Parameters<typeof assertSender>[1],url:string,ports:InstructorFilePorts){
 let disposed=false,busy=false;const abort=new AbortController();
 const wait=<T>(promise:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{const stop=()=>reject(Error('closed'));if(abort.signal.aborted){stop();return;}abort.signal.addEventListener('abort',stop,{once:true});promise.then(v=>{abort.signal.removeEventListener('abort',stop);resolve(v);},e=>{abort.signal.removeEventListener('abort',stop);reject(e);});});let pending:Promise<unknown>|undefined;
 const handlers=Object.fromEntries(['stampRead','stampPick','stampRemove','workbookPick','workbookSave','print'].map(action=>[action,async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<FileResult<unknown>>=>{
  if(busy)return{ok:false,message:'파일 작업이 진행 중입니다.'};busy=true;
  const run=async():Promise<FileResult<unknown>>=>{try{
   assertSender(event,contents,url);if(disposed||args.length!==1)throw Error('request');const i=args[0] as InstructorFilesRequest;
   if(!i||Object.keys(i).some(k=>!['school','month','version','kind','includeStamp'].includes(k))||!uuid(i.school)||!Number.isSafeInteger(i.version))throw Error('request');monthValue(i.month);
   const identity=await ports.authorize(i.school);const fresh=async()=>{assertSender(event,contents,url);const next=await ports.authorize(i.school);if(disposed||next.user!==identity.user||next.generation!==identity.generation)throw Error('stale');};
   await fresh();
   if(action==='stampRead'){const data=await ports.stamp.read(identity.user);await fresh();return{ok:true,status:'ready',data};}
   if(action==='stampPick'){
    const path=await wait(ports.pick('stamp'));await fresh();if(!path)return{ok:true,status:'canceled'};
    const original=await readInstructorFile(path,2*1024*1024,['.png','.jpg','.jpeg']);const dimensions=stampDimensions(original),png=ports.decode(original),normalized=stampDimensions(png);
    if(dimensions.width!==normalized.width||dimensions.height!==normalized.height)throw Error('image');await fresh();
    if(!await wait(ports.confirm('선택한 도장을 이 계정의 로컬 개인 저장소에 저장·교체할까요? 공동 공간에는 업로드하지 않습니다.')))return{ok:true,status:'canceled'};await fresh();
    const data=await ports.stamp.save(identity.user,png,()=>{if(disposed)throw Error('closed');});await fresh();return{ok:true,status:'saved',data};
   }
   if(action==='stampRemove'){if(!await wait(ports.confirm('이 계정에 등록한 개인 도장을 삭제할까요?')))return{ok:true,status:'canceled'};await fresh();await ports.stamp.remove(identity.user);await fresh();return{ok:true,status:'saved',data:null};}
   const state=await ports.board(i.school,i.month);await fresh();if(state.phase!=='ready'||!state.board?.instructor||state.board.version!==i.version)throw Error('conflict');const board:Board=state.board;
   if(action==='workbookPick'){const path=await wait(ports.pick('workbook'));await fresh();if(!path)return{ok:true,status:'canceled'};const bytes=await readInstructorFile(path,10*1024*1024,['.xlsx']);const data=await (ports.worker??worker)({kind:'read',bytes,input:{instructorId:board.instructor!.id,existingLogs:board.logs}},abort.signal);await fresh();return{ok:true,status:'ready',data};}
   if(action==='workbookSave'){
    const bytes=await (ports.worker??worker)<Uint8Array>({kind:'write',board,month:i.month},abort.signal);if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>8*1024*1024)throw Error('workbook');
    const path=await wait(ports.save(i.month));await fresh();if(!path)return{ok:true,status:'canceled'};const rel=relative(ports.protectedRoot,path);if(!rel||!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep))throw Error('target');
    const result=await writeSelectedExport(path,'xlsx',Buffer.from(bytes),async()=>{const yes=await wait(ports.confirm('기존 Excel 파일을 교체할까요?'));await fresh();return yes;},()=>{if(disposed)throw Error('closed');});await fresh();return{ok:true,status:result.status,data:null};
   }
   if(!['attendance','payment','detail'].includes(i.kind??'')||typeof i.includeStamp!=='boolean'||i.includeStamp&&i.kind!=='attendance')throw Error('print');
   if(i.includeStamp&&!await ports.stamp.read(identity.user))throw Error('stamp');
   if(!await wait(ports.confirm(`미리보기의 ${i.kind==='attendance'?'출근관리부':i.kind==='payment'?'지급명세서':'월별 근무내역'}를 ${i.includeStamp?'개인 도장 포함':'도장 미포함'}으로 인쇄할까요?`)))return{ok:true,status:'canceled'};
   await fresh();const printed=await wait(ports.print());await fresh();return{ok:true,status:printed?'saved':'canceled',data:null};
  }catch{return{ok:false,message:'파일·출력을 처리하지 못했습니다. 형식·크기·권한·변경 여부를 확인하세요. 기존 도장과 근무 자료는 유지됩니다.'};}};
  pending=run();try{return await pending as FileResult<unknown>;}finally{busy=false;pending=undefined;}
 }])) as Record<string,(e:Parameters<typeof assertSender>[0],...args:unknown[])=>Promise<FileResult<unknown>>>;
 return{handlers,dispose(){disposed=true;abort.abort();},async flush(){await pending;}};
}
