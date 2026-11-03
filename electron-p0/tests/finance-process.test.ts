import {it,expect,vi} from 'vitest';import {EventEmitter} from 'node:events';import {PassThrough,Writable} from 'node:stream';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import type {spawn} from 'node:child_process';
import {FinanceProcess} from '../main/finance-process';
async function fake(reply?:(request:any,child:any)=>void){
 const root=await mkdtemp(join(tmpdir(),'finance-process-')),exe=join(root,'my-finance-cli.exe');await writeFile(exe,'SYNTHETIC NOT EXECUTED');
 const child:any=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.signalCode=null;child.killed=false;
 child.kill=vi.fn(()=>{child.killed=true;child.signalCode='SIGTERM';queueMicrotask(()=>child.emit('exit',null,'SIGTERM'));return true;});
 const frames:any[]=[];child.stdin=new Writable({write(chunk,_encoding,callback){const request=JSON.parse(chunk.toString());frames.push(request);queueMicrotask(()=>{if(reply)reply(request,child);else child.stdout.write(JSON.stringify({version:1,id:request.id,ok:true,data:{identity:'synthetic'}})+'\n');});callback();},final(callback){child.exitCode=0;queueMicrotask(()=>child.emit('exit',0));callback();}});
 const launch=vi.fn(()=>{queueMicrotask(()=>child.stdout.write('{"version":1,"ready":"sqlcipher-dpapi"}\n'));return child;});
 const worker=new FinanceProcess(exe,join(root,'private-finance'),'win32',launch as unknown as typeof spawn,20);
 return {worker,launch,child,frames,root,exe};
}
it('uses only a fixed executable/root and private stdin, with a bounded versioned response',async()=>{
 const ctx=await fake();try{await ctx.worker.call({operation:'load'});await ctx.worker.call({operation:'exportBackup',password:'synthetic-secret',path:'synthetic-selected.bgfnbk'});expect(ctx.launch).toHaveBeenCalledTimes(1);const args=ctx.launch.mock.calls[0] as unknown as unknown[];expect(args[0]).toBe(ctx.exe);expect(args[1]).toEqual(['--root',join(ctx.root,'private-finance')]);expect(args[2]).toMatchObject({shell:false,windowsHide:true});expect(JSON.stringify(args)).not.toContain('synthetic-secret');expect(ctx.frames[1].request.password).toBe('synthetic-secret');}finally{await ctx.worker.close();await rm(ctx.root,{recursive:true,force:true});}expect(ctx.child.exitCode).toBe(0);
});
it('rejects mismatched response IDs and kills only its own engine without retrying',async()=>{
 const ctx=await fake((request,child)=>child.stdout.write(JSON.stringify({version:1,id:request.id+1,ok:true,data:'synthetic-secret'})+'\n'));try{await expect(ctx.worker.call({operation:'load'})).rejects.toThrow('기존 파일');expect(ctx.launch).toHaveBeenCalledTimes(1);expect(ctx.child.kill).toHaveBeenCalledTimes(1);}finally{await ctx.worker.close();await rm(ctx.root,{recursive:true,force:true});}
});
it('times out a request, drains no sensitive stderr into the error, and does not replay the mutation',async()=>{
 const ctx=await fake((_request,child)=>child.stderr.write('synthetic-private-finance-value'));try{await expect(ctx.worker.call({operation:'createIncome',entry:'synthetic'})).rejects.toThrow('기존 파일');expect(ctx.frames).toHaveLength(1);expect(ctx.child.kill).toHaveBeenCalledTimes(1);}finally{await ctx.worker.close();await rm(ctx.root,{recursive:true,force:true});}
});
it('rejects non-Windows launch without creating files or invoking another executable',async()=>{
 const launch=vi.fn();const worker=new FinanceProcess('/synthetic/finance.exe','/synthetic/data','linux',launch as unknown as typeof spawn);expect(await worker.available()).toBe(false);await expect(worker.call({operation:'load'})).rejects.toThrow('Windows');expect(launch).not.toHaveBeenCalled();await worker.close();
});
