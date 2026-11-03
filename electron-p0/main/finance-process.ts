import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {lstat} from 'node:fs/promises';
const LIMIT=70*1024*1024;
export const FINANCE_FAILURE='암호화 금융 작업을 완료하지 못했습니다. 기존 파일을 보존하고 최신 목록을 확인해 주세요.';
export const FINANCE_CONFLICT='금융 데이터가 변경되었습니다. 최신 목록을 다시 불러와 주세요.';
export class FinanceEngineError extends Error{}
export type FinanceWorker={call:(request:Record<string,unknown>)=>Promise<unknown>;close:()=>Promise<void>;available:()=>Promise<boolean>};
export class FinanceProcess implements FinanceWorker{
 private child:ChildProcessWithoutNullStreams|null=null;
 private ready:Promise<void>|null=null;
 private readiness:{resolve:()=>void;reject:(error:Error)=>void}|null=null;
 private pending:{id:number;resolve:(data:unknown)=>void;reject:(error:Error)=>void}|null=null;
 private buffer=Buffer.alloc(0);
 private sequence=0;
 private closed=false;
 private readyTimer:ReturnType<typeof setTimeout>|undefined;
 private requestTimer:ReturnType<typeof setTimeout>|undefined;
 constructor(private readonly executable:string,private readonly root:string,private readonly platform:NodeJS.Platform=process.platform,private readonly launch:typeof spawn=spawn,private readonly timeoutMs=120000){}
 async available(){if(this.platform!=='win32')return false;try{const info=await lstat(this.executable);return info.isFile()&&!info.isSymbolicLink();}catch{return false;}}
 private fail(){clearTimeout(this.readyTimer);clearTimeout(this.requestTimer);const error=new FinanceEngineError(FINANCE_FAILURE);this.readiness?.reject(error);this.readiness=null;this.pending?.reject(error);this.pending=null;this.buffer=Buffer.alloc(0);if(this.child&&!this.child.killed)this.child.kill();this.closed=true;}
 private data(chunk:Buffer){
  if(this.closed)return;if(this.buffer.length+chunk.length>LIMIT){this.fail();return;}this.buffer=Buffer.concat([this.buffer,chunk]);
  let newline:number;while((newline=this.buffer.indexOf(10))>=0){const bytes=this.buffer.subarray(0,newline);this.buffer=this.buffer.subarray(newline+1);let frame:Record<string,unknown>;
   try{frame=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{this.fail();return;}
   if(!frame||typeof frame!=='object'||Array.isArray(frame)||frame.version!==1){this.fail();return;}
   if(this.readiness){if(Object.keys(frame).sort().join(',')!=='ready,version'||frame.ready!=='sqlcipher-dpapi'){this.fail();return;}clearTimeout(this.readyTimer);this.readiness.resolve();this.readiness=null;continue;}
   if(!this.pending||frame.id!==this.pending.id||typeof frame.ok!=='boolean'||Object.keys(frame).sort().join(',')!==(frame.ok?'data,id,ok,version':'error,id,ok,version')){this.fail();return;}
   const pending=this.pending;this.pending=null;clearTimeout(this.requestTimer);
   if(frame.ok)pending.resolve(frame.data);else pending.reject(new FinanceEngineError(frame.error===FINANCE_CONFLICT?FINANCE_CONFLICT:FINANCE_FAILURE));
  }
 }
 private async start(){
  if(this.child){if(this.closed)throw new FinanceEngineError(FINANCE_FAILURE);return this.ready;}
  if(!await this.available())throw new FinanceEngineError('Windows SQLCipher·DPAPI 엔진을 사용할 수 없습니다. 평문 저장은 허용하지 않습니다.');
  this.closed=false;
  // Fixed binary/root; passwords and finance values are never command arguments or env values.
  const env:NodeJS.ProcessEnv={};for(const key of ['SystemRoot','WINDIR','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
  const child=this.launch(this.executable,['--root',this.root],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env}) as ChildProcessWithoutNullStreams;this.child=child;
  this.ready=new Promise<void>((resolve,reject)=>{this.readiness={resolve,reject};});
  this.readyTimer=setTimeout(()=>this.fail(),10000);
  child.stdout.on('data',(chunk:Buffer)=>this.data(chunk));let stderr=0;child.stderr.on('data',(chunk:Buffer)=>{stderr+=chunk.length;if(stderr>16384)this.fail();});
  child.on('error',()=>this.fail());child.on('exit',()=>{if(this.pending||this.readiness)this.fail();this.closed=true;});
  await this.ready;
 }
 async call(request:Record<string,unknown>){
  if(this.pending)throw new FinanceEngineError(FINANCE_FAILURE);
  const bytes=Buffer.from(JSON.stringify({version:1,id:++this.sequence,request})+'\n');if(bytes.length>LIMIT)throw new FinanceEngineError(FINANCE_FAILURE);
  if(this.closed&&this.child&&request.operation==='load')await this.close();
  await this.start();if(this.closed||!this.child)throw new FinanceEngineError(FINANCE_FAILURE);
  return new Promise<unknown>((resolve,reject)=>{this.pending={id:this.sequence,resolve,reject};this.requestTimer=setTimeout(()=>this.fail(),this.timeoutMs);this.child!.stdin.write(bytes,error=>{if(error)this.fail();});});
 }
 async close(){
  const child=this.child;if(!child)return;this.closed=true;this.readiness?.reject(new FinanceEngineError(FINANCE_FAILURE));this.readiness=null;this.pending?.reject(new FinanceEngineError(FINANCE_FAILURE));this.pending=null;clearTimeout(this.readyTimer);clearTimeout(this.requestTimer);
  await new Promise<void>(resolve=>{if(child.exitCode!==null||child.signalCode!==null){resolve();return;}const timer=setTimeout(()=>{if(!child.killed)child.kill();},10000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.once('error',()=>{clearTimeout(timer);resolve();});child.stdin.end();});
  this.child=null;this.ready=null;this.buffer=Buffer.alloc(0);
 }
}
