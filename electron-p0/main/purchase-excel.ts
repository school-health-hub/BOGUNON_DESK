import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,extname,basename} from 'node:path';
import {readSelectedPurchaseFile} from './purchase-import.js';
import type {PurchaseAnalysisResult,PurchaseMappingCandidate,PurchaseColumnMapping} from '../renderer/purchase/purchase/types.js';
const MAX_IO=64*1024*1024;
/** No shell, inherited credentials, renderer-provided executable, or unbounded output. */
export function runExcelCli(executable:string,request:unknown,signal:AbortSignal,timeoutMs=30_000,launch:typeof spawn=spawn):Promise<PurchaseAnalysisResult>{
 const input=Buffer.from(JSON.stringify({version:1,request}));
 if(input.length>MAX_IO||signal.aborted)return Promise.reject(Error('Excel request unavailable'));
 return new Promise((resolve,reject)=>{
  const child=launch(executable,[],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{}),RUST_BACKTRACE:'0'}});
  let failed=false,total=0,errors=0;const output:Buffer[]=[];
  const stop=()=>{failed=true;child.kill('SIGKILL');};
  const timer=setTimeout(stop,timeoutMs);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
  child.stdout.on('data',(chunk:Buffer)=>{total+=chunk.length;if(total>MAX_IO)stop();else if(!failed)output.push(chunk);});
  child.stderr.on('data',(chunk:Buffer)=>{errors+=chunk.length;if(errors>4096)stop();}); // discard, never log paths/cells
  child.on('error',()=>{failed=true;});child.stdin.on('error',()=>{failed=true;});
  child.on('close',code=>{
   clearTimeout(timer);signal.removeEventListener('abort',stop);
   if(failed||code!==0){reject(Error('Excel analysis unavailable'));return;}
   try{
    const envelope=JSON.parse(Buffer.concat(output).toString('utf8'));
    if(envelope?.version!==1||envelope.ok!==true)throw Error();
    const r=envelope.data as PurchaseAnalysisResult;
    if(!r||!Array.isArray(r.items)||r.items.length>500||!Array.isArray(r.sources)||r.sources.length>1||!Array.isArray(r.candidates)||r.candidates.length>1)throw Error();
    if(r.items.some(i=>typeof i.id!=='string'||typeof i.name!=='string'||!Array.isArray(i.issues)))throw Error();
    if(r.candidates.some(c=>typeof c.id!=='string'||!Array.isArray(c.rows)||c.rows.length>530||c.rows.some((row:unknown)=>!Array.isArray(row)||row.length>256||row.some((v:unknown)=>typeof v!=='string'))||!Array.isArray(c.headerOptions)))throw Error();
    resolve(r);
   }catch{reject(Error('Invalid Excel response'));}
  });
  child.stdin.end(input);
 });
}
export class ExcelService {
 private readonly pending=new Set<Promise<unknown>>();
 private track<T>(task:Promise<T>):Promise<T>{this.pending.add(task);void task.finally(()=>this.pending.delete(task)).catch(()=>{});return task;}
 async flush(){await Promise.allSettled([...this.pending]);}
 constructor(private readonly executable:string,private readonly tempRoot:string){}
 analyze(path:string,signal:AbortSignal){return this.track(this.analyzeFile(path,signal,['.xlsx','.xls']));}
 analyzePdf(path:string,signal:AbortSignal){return this.track(this.analyzeFile(path,signal,['.pdf']));}
 private async analyzeFile(path:string,signal:AbortSignal,extensions:readonly string[]):Promise<PurchaseAnalysisResult>{
  const bytes=await readSelectedPurchaseFile(path,extensions);if(signal.aborted)throw Error('Canceled');
  await mkdir(this.tempRoot,{recursive:true,mode:0o700});const dir=await mkdtemp(join(this.tempRoot,'request-'));
  try{
   const snapshot=join(dir,`input${extname(path).toLowerCase()}`);await writeFile(snapshot,bytes,{flag:'wx',mode:0o600});
   const result=await runExcelCli(this.executable,{operation:'analyze',path:snapshot},signal);
   const sourceName=basename(path);
   return {...result,items:result.items.map(i=>({...i,sourceName})),sources:result.sources.map(s=>({...s,sourceName})),candidates:result.candidates.map(c=>({...c,sourceName}))};
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 map(candidate:PurchaseMappingCandidate,headerRow:number,mapping:PurchaseColumnMapping,signal:AbortSignal){return this.track(runExcelCli(this.executable,{operation:'map',candidate,headerRow,mapping},signal));}
}
