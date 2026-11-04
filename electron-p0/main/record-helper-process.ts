import {spawn} from 'node:child_process';
import {lstat} from 'node:fs/promises';
import {StringDecoder} from 'node:string_decoder';
import {normalizeImportBatch} from './record-helper/import-contract.js';
export class RecordProcessError extends Error{}
export class RecordHelperProcess{
 private active:Promise<unknown>|null=null;
 constructor(private readonly executable:string,private readonly timeoutMs=30000){}
 async run(path:string,signal:AbortSignal){
  if(this.active)throw new RecordProcessError('busy');const info=await lstat(this.executable).catch(()=>null);if(!info?.isFile()||info.isSymbolicLink())throw new RecordProcessError('missingRuntime');if(signal.aborted)throw new RecordProcessError('canceled');
  const input=Buffer.from(JSON.stringify({version:1,path}));if(input.length>65536)throw new RecordProcessError('input');
  const pending=new Promise<ReturnType<typeof normalizeImportBatch>>((resolve,reject)=>{
   const env:NodeJS.ProcessEnv={};for(const key of ['SystemRoot','WINDIR','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
   const child=spawn(this.executable,[],{env,stdio:['pipe','pipe','pipe'],windowsHide:true}),decoder=new StringDecoder('utf8');let output='',size=0,failed='';
   const stop=(code:string)=>{failed||=code;output='';child.kill();};const cancel=()=>stop('canceled');signal.addEventListener('abort',cancel,{once:true});
   const timer=setTimeout(()=>stop('timeout'),this.timeoutMs);
   child.stdout.on('data',(bytes:Buffer)=>{if(failed)return;size+=bytes.length;if(size>16*1024*1024){stop('oversized');return;}output+=decoder.write(bytes);});
   child.stderr.on('data',()=>{});child.stdin.on('error',()=>stop('io'));child.on('error',()=>{failed||='missingRuntime';});
   child.once('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);try{if(failed||signal.aborted||code!==0)throw new RecordProcessError(failed||'invalid');const response=JSON.parse(output+decoder.end());output='';if(!response||Object.keys(response).sort().join(',')!=='data,ok'||response.ok!==true)throw Error();resolve(normalizeImportBatch(response.data));}catch{output='';reject(new RecordProcessError(failed||'invalid'));}});
   child.stdin.end(input);if(signal.aborted)cancel();
  });this.active=pending;try{return await pending;}finally{if(this.active===pending)this.active=null;}
 }
 async flush(){await this.active?.catch(()=>{});}
}
