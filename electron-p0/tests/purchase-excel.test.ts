import {it,expect,vi} from 'vitest';import {EventEmitter} from 'node:events';import type {spawn} from 'node:child_process';
import {mkdtemp,readdir,rm} from 'node:fs/promises';import {existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';
import {runExcelCli,ExcelService} from '../main/purchase-excel';import {createExcelHandlers} from '../main/purchase-excel-ipc';
const root=resolve('tools/purchase-excel-cli'),name=process.platform==='win32'?'purchase-excel-cli.exe':'purchase-excel-cli';
const exe=(existsSync(join(root,'target/debug',name))?join(root,'target/debug',name):resolve('build/purchase-excel-cli',name)),fixtures=join(root,'target/qa-fixtures');
it('runs real XLSX/XLS children with automatic selection and maps original candidates; cleans staged files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'excel-service-'));const service=new ExcelService(exe,dir);
 try{
  const r=await service.analyze(join(fixtures,'synthetic.xlsx'),new AbortController().signal);expect(r.items).toHaveLength(2);expect(r.sources[0].sourceName).toBe('synthetic.xlsx');expect(JSON.stringify(r)).not.toContain(dir);expect(await readdir(dir)).toEqual([]);
  expect((await service.analyze(join(fixtures,'synthetic.xls'),new AbortController().signal)).items[0].name).toBe('합성 XLS');
  const unknown=await service.analyze(join(fixtures,'unknown.xlsx'),new AbortController().signal);const result=await service.map(unknown.candidates[0],0,{name:0,quantity:1,unitPrice:2},new AbortController().signal);expect(result.items[0]).toMatchObject({name:'합성 매핑',quantity:3,unitPrice:25});await service.flush();expect(await readdir(dir)).toEqual([]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('cleans snapshots after a missing CLI or cancellation without changing source files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'excel-service-'));try{
  const service=new ExcelService(join(dir,'missing.exe'),dir);await expect(service.analyze(join(fixtures,'synthetic.xlsx'),new AbortController().signal)).rejects.toThrow();await service.flush();expect(await readdir(dir)).toEqual([]);
  const aborted=new AbortController();aborted.abort();await expect(service.analyze(join(fixtures,'synthetic.xlsx'),aborted.signal)).rejects.toThrow();expect(await readdir(dir)).toEqual([]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
function fakeChild(){const c=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:Object.assign(new EventEmitter(),{end:vi.fn()}),kill:vi.fn(()=>true)});return c;}
it('kills on cancel/timeout and waits for child close before rejecting, with shell disabled and no credential inheritance',async()=>{
 for(const reason of ['cancel','timeout']){
  const child=fakeChild(),launch=vi.fn(()=>child),abort=new AbortController();let settled=false;
  const pending=runExcelCli('/fixed/cli',{operation:'map'},abort.signal,10,launch as unknown as typeof spawn).catch(()=>{settled=true;});
  expect(launch.mock.calls[0]).toEqual(['/fixed/cli',[],expect.objectContaining({shell:false,windowsHide:true,env:expect.not.objectContaining({GH_TOKEN:expect.anything()})})]);
  if(reason==='cancel')abort.abort();else await new Promise(r=>setTimeout(r,25));expect(child.kill).toHaveBeenCalledWith('SIGKILL');expect(settled).toBe(false);child.emit('close',1);await pending;expect(settled).toBe(true);
 }
});
it('rejects protocol mismatches and resource-limit failure exits',async()=>{
 for(const [code,response] of [[78,''],[0,'{"version":99,"ok":true}'],[0,'malformed'] ] as const){
  const c=fakeChild();const pending=runExcelCli('/fixed/cli',{},new AbortController().signal,1000,(()=>c) as unknown as typeof spawn);c.stdout.emit('data',Buffer.from(response));c.emit('close',code);await expect(pending).rejects.toThrow();
 }
});
const url='file:///p0/index.html',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
it('rejects paths/callers; invalidates pending Excel analysis on cancel and refuses duplicate selection',async()=>{
 let finish!:(value:never)=>void;let signal:AbortSignal|undefined;
 const service={analyze:vi.fn((_p:string,s:AbortSignal)=>{signal=s;return new Promise<never>(r=>{finish=r;});}),map:vi.fn()};const select=vi.fn(async()=>'/selected.xlsx'),h=createExcelHandlers(wc,url,select,service);
 expect(await h.pick(event,'C:/forged.xlsx')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(await h.pick({sender:{},senderFrame:frame})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(select).not.toHaveBeenCalled();
 const pending=h.pick(event);await vi.waitFor(()=>expect(service.analyze).toHaveBeenCalled());expect(await h.pick(event)).toMatchObject({ok:false});await h.cancel(event);expect(signal?.aborted).toBe(true);finish({items:[],sources:[],candidates:[]} as never);expect(await pending).toEqual({ok:true,data:null});
});
it('uses main-owned candidate data, consumes it once and blocks stale mapping results',async()=>{
 const candidate={id:'c',sourceName:'synthetic',sheetName:'Sheet1',rows:[['a','b'],['합성','1']],headerOptions:[{rowIndex:0,headers:['a','b'],signature:['a','b'],recommended:true}]};
 let finish!:(r:never)=>void;const service={analyze:vi.fn(async()=>({items:[],sources:[],candidates:[candidate]})),map:vi.fn((_candidate:unknown)=>new Promise<never>(r=>{finish=r;}))};const h=createExcelHandlers(wc,url,async()=>'/selected.xlsx',service),r=await h.pick(event);if(!r.ok||!r.data)throw Error();
 const request={generation:r.data.generation,candidateId:'c',headerRow:0,mapping:{name:0}};
 expect(await h.map(event,{...request,path:'/forged'})).toMatchObject({ok:false});const pending=h.map(event,request);expect(await h.map(event,request)).toMatchObject({ok:false});await h.cancel(event);finish({items:[],sources:[],candidates:[]} as never);expect(await pending).toMatchObject({ok:false});expect(service.map.mock.calls[0][0]).toEqual(candidate);
});
it('bounds stdout and stdin and never resolves before the terminated process closes',async()=>{
 const c=fakeChild();const pending=runExcelCli('/fixed/cli',{},new AbortController().signal,1000,(()=>c) as unknown as typeof spawn);c.stdout.emit('data',Buffer.alloc(64*1024*1024+1));expect(c.kill).toHaveBeenCalledWith('SIGKILL');c.emit('close',1);await expect(pending).rejects.toThrow();
 const launch=vi.fn();await expect(runExcelCli('/fixed/cli',{data:'x'.repeat(64*1024*1024)},new AbortController().signal,1000,launch as unknown as typeof spawn)).rejects.toThrow();expect(launch).not.toHaveBeenCalled();
});
