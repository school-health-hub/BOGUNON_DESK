import {it,expect,vi} from 'vitest';
import {mkdtemp,writeFile,rm,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createPurchaseImportHandlers,readSelectedCsv} from '../main/purchase-import';
const url='file:///p0/index.html',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
const data=Buffer.from('품명,수량,단가\n합성,2,100');
it('reads only a native dialog-selected CSV, returns no absolute path and rejects paths/callers before dialog/read',async()=>{
 const select=vi.fn(async()=>'/isolated/synthetic.csv'),read=vi.fn(async()=>data),h=createPurchaseImportHandlers(wc,url,select,read);
 expect(await h.pick(event,'/anything.csv')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 for(const e of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}},{sender:wc,senderFrame:null}]){
  expect(await h.pick(e)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.cancel(e)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.map(e,{})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 }
 expect(select).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();
 const reply=await h.pick(event);expect(reply).toMatchObject({ok:true,data:{result:{items:[{sourceName:'synthetic.csv'}]}}});expect(JSON.stringify(reply)).not.toContain('/isolated');
});
it('does not read on native cancellation, rejects concurrent selections and drops a canceled read result',async()=>{
 const canceledRead=vi.fn();expect(await createPurchaseImportHandlers(wc,url,async()=>undefined,canceledRead).pick(event)).toEqual({ok:true,data:null});expect(canceledRead).not.toHaveBeenCalled();
 let finish!:(b:Buffer)=>void;const read=vi.fn(()=>new Promise<Buffer>(resolve=>{finish=resolve;}));const h=createPurchaseImportHandlers(wc,url,async()=>'/synthetic.csv',read);
 const pending=h.pick(event);await vi.waitFor(()=>expect(read).toHaveBeenCalled());expect(await h.pick(event)).toMatchObject({ok:false});await h.cancel(event);finish(data);expect(await pending).toEqual({ok:true,data:null});
});
it('maps only its own current candidate, rejects forged rows, stale tokens, extra arguments and duplicate columns',async()=>{
 const h=createPurchaseImportHandlers(wc,url,async()=>'/synthetic.csv',async()=>Buffer.from('대상,개입,예상값\n합성,2,100'));
 const reply=await h.pick(event);if(!reply.ok||!reply.data)throw Error('fixture');const {generation,result}=reply.data;
 const request={generation,candidateId:result.candidates[0].id,headerRow:0,mapping:{name:0,quantity:1,unitPrice:2}};
 for(const args of [[{...request,rows:[['forged']]}],[{...request,generation:999}],[{...request,candidateId:'forged'}],[{...request,headerRow:1}],[{...request,mapping:{name:0,quantity:0}}],[request,request]])expect(await h.map(event,...args)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await h.map(event,request)).toMatchObject({ok:true,data:{result:{items:[{name:'합성',quantity:2,unitPrice:100}],candidates:[]}}});expect(await h.map(event,request)).toMatchObject({ok:false});
 await h.cancel(event);expect(await h.map(event,request)).toMatchObject({ok:false});
});
it('returns safe errors without paths or cell data and denies navigation during selection',async()=>{
 const h=createPurchaseImportHandlers(wc,url,async()=>'/private/synthetic.csv',async()=>{throw Error('sensitive cell/path');});const reply=await h.pick(event);expect(reply).toMatchObject({ok:false});expect(JSON.stringify(reply)).not.toMatch(/private|sensitive/);
 let address=url;const c={mainFrame:frame,getURL:()=>address},r=vi.fn(async()=>data);
 expect(await createPurchaseImportHandlers(c,url,async()=>{address='https://evil.invalid';return '/synthetic.csv';},r).pick({sender:c,senderFrame:frame})).toEqual({ok:true,data:null});expect(r).not.toHaveBeenCalled();
});
it('bounds actual reads, rejects directories/links/non-CSV and leaves selected synthetic files unchanged',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'purchase-csv-'));
 try{
  const path=join(dir,'synthetic.csv');await writeFile(path,data);expect(Buffer.from(await readSelectedCsv(path))).toEqual(data);expect(Buffer.from(await readSelectedCsv(path))).toEqual(data);
  await writeFile(join(dir,'synthetic.txt'),data);await expect(readSelectedCsv(join(dir,'synthetic.txt'))).rejects.toThrow();
  await mkdir(join(dir,'directory.csv'));await expect(readSelectedCsv(join(dir,'directory.csv'))).rejects.toThrow();
  await symlink(path,join(dir,'link.csv'));await expect(readSelectedCsv(join(dir,'link.csv'))).rejects.toThrow();
  await writeFile(join(dir,'large.csv'),Buffer.alloc(15*1024*1024+1));await expect(readSelectedCsv(join(dir,'large.csv'))).rejects.toThrow();
 }finally{await rm(dir,{recursive:true,force:true});}
});
