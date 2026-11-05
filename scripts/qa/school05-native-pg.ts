/** Windows CI only: native PostgreSQL compatibility for the external synthetic QA provider. Never packaged. */
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {resolve,join,sep} from 'node:path';
const exec=promisify(execFile);
export async function sql(query:string,user='postgres',signal?:AbortSignal){
 const root=resolve(process.env.TD2_ROOT??''),data=resolve(process.env.SCHOOL05_PG_DATA??''),bin=process.env.SCHOOL05_PG_BIN??'',port=process.env.SCHOOL05_PG_PORT??'';
 if(process.platform!=='win32'||!process.env.TD2_ROOT||!data.startsWith(root+sep)||!/^\d{4,5}$/.test(port)||Number(port)>65535||!['postgres','school_client'].includes(user)||!bin)throw Error('Synthetic native PostgreSQL configuration rejected');
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));Object.assign(env,{PGCONNECT_TIMEOUT:'5',PGPASSFILE:join(root,'no-password-file'),PGCLIENTENCODING:'UTF8'});
 const diag=globalThis as unknown as Record<string,unknown>;
 try{
  // Feed SQL as UTF-8 stdin: Windows native argv parsing must not rewrite SQL quotes/JSON claims.
  const pending=exec(join(bin,'psql.exe'),['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U',user,'-d','school01a','-f','-'],{env,signal,timeout:15000,maxBuffer:1048576,windowsHide:true});
  pending.child.stdin?.on('error',()=>{});pending.child.stdin?.end(query,'utf8');
  const {stdout}=await pending;diag.__school05NativePgDiag={stage:'success',user,stdoutBytes:Buffer.byteLength(stdout)};return stdout.trim();
 }catch(error){const e=error as {code?:unknown;stderr?:unknown};const stderr=String(e.stderr??'').replace(/SCHOOL01C_MOCK[^\s'";]*/g,'[redacted]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted]').slice(0,600);diag.__school05NativePgDiag={stage:'psql-error',code:e.code,stderr};throw error;}
}
