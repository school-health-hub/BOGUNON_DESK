import {spawn} from 'node:child_process';
import type {Readable,Writable} from 'node:stream';
import {HostError,fixedError} from './errors.js';

export type Exit=Readonly<{code:number|null;signal:NodeJS.Signals|null}>;
export interface ProcessPort {
  readonly pid:number;readonly input:Writable;readonly output:Readable;
  readonly exited:Promise<Exit>;terminate():boolean;
}
export type Spawner=(image:string,timeoutMs?:number)=>Promise<ProcessPort>;
/** Only issuer-approved callers may supply image. No shell, inherited secrets or public endpoint. */
export const spawnHost:Spawner=async (image,timeoutMs=5000)=>new Promise((resolve,reject)=>{
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0){reject(new HostError('Deadline'));return;}
  const child=spawn(image,['--inherited-restore-only'],{shell:false,windowsHide:true,
    env:{SystemRoot:process.env['SystemRoot']??'C:\\Windows',WINDIR:process.env['WINDIR']??'C:\\Windows'},
    stdio:['pipe','pipe','pipe']});
  child.stderr.resume();
  let abandoned=false;
  const timer=setTimeout(()=>{abandoned=true;child.kill();reject(new HostError('Deadline'));},Math.min(timeoutMs,5000));
  const exited=new Promise<Exit>(done=>child.once('close',(code,signal)=>done({code,signal})));
  child.once('error',error=>{clearTimeout(timer);reject(fixedError(error));});
  child.once('spawn',()=>{
    clearTimeout(timer);
    if(abandoned){child.kill();return;}
    if(!child.pid){reject(new HostError('SpawnFailed'));return;}
    resolve({pid:child.pid,input:child.stdin,output:child.stdout,exited,terminate:()=>child.kill()});
  });
});
