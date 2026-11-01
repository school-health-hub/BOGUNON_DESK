import type {PurchaseExportRequest} from '../protocol';
import {writeFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';import {mkdtemp,readFile,writeFile,rm,readdir,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {existsSync} from 'node:fs';
import {validatePurchaseExport,purchaseExportFileName} from '../main/purchase-export-validation';import {createEmptyPurchaseItem,updatePurchaseItem} from '../renderer/purchase/purchase/purchaseDomain';import {writePurchaseExport,ExportConflict} from '../main/purchase-export-storage';import {createPurchaseExportHandler} from '../main/purchase-export';import {ExcelService} from '../main/purchase-excel';
const item=updatePurchaseItem(createEmptyPurchaseItem('synthetic-export'),{name:'합성 품목',quantity:2.5,unitPrice:100.6});const request={format:'csv' as const,items:[item],columns:['name','amount','quantity','unitPrice','specification'] as const};
const url='file:///p0',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
it('reuses original amount validation, recomputes forged issues and rejects invalid/oversized/path-bearing requests',()=>{
 expect(validatePurchaseExport(request).items[0].issues).toEqual([]);
 for(const bad of [{...request,path:'C:/forged.csv'},{...request,format:'edufine'},{...request,columns:['amount']},{...request,columns:['name','name']},{...request,items:[]},{...request,items:[item,item]},{...request,items:[{...item,name:''}]},{...request,items:[{...item,quantity:0}]},{...request,items:[{...item,unitPrice:-1,issues:[]}]},{...request,items:[{...item,quantity:Infinity}]},{...request,items:[{...item,quantity:null}]},{...request,items:[{...item,importedAmount:99999,issues:[],amountMismatchReviewed:false}]},{...request,items:[{...item,name:' \n=CMD'}]}])expect(()=>validatePurchaseExport(bad)).toThrow();
 expect(()=>validatePurchaseExport({...request,items:[{...item,importedAmount:99999,amountMismatchReviewed:true}]})).not.toThrow();
});
it('publishes new files, confirms overwrites, detects content/appearance changes and preserves files on denied/failed replacement',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'purchase-export-')),path=join(dir,'synthetic.csv'),bytes=Buffer.from('\ufeff품명\n합성\n');
 try{
  const confirm=vi.fn(async()=>true);expect(await writePurchaseExport(path,'csv',bytes,confirm)).toMatchObject({status:'saved',fileName:'synthetic.csv'});expect(confirm).not.toHaveBeenCalled();
  await writeFile(path,'original');expect(await writePurchaseExport(path,'csv',bytes,async()=>false)).toEqual({status:'canceled'});expect(await readFile(path,'utf8')).toBe('original');
  await expect(writePurchaseExport(path,'csv',bytes,async()=>{await writeFile(path,'external edit');return true;})).rejects.toBeInstanceOf(ExportConflict);expect(await readFile(path,'utf8')).toBe('external edit');
  const denied=vi.fn(async()=>{throw Object.assign(Error('synthetic'),{code:'EACCES'});});await expect(writePurchaseExport(path,'csv',bytes,async()=>true,()=>{},denied)).rejects.toThrow();expect(await readFile(path,'utf8')).toBe('external edit');
  await expect(writePurchaseExport(path,'csv',bytes,async()=>true,()=>{throw Error('canceled');})).rejects.toThrow();expect(await readFile(path,'utf8')).toBe('external edit');
  expect((await readdir(dir)).filter(p=>p.endsWith('.tmp'))).toEqual([]);
  const appeared=join(dir,'appeared.csv');let checks=0;await expect(writePurchaseExport(appeared,'csv',bytes,async()=>true,()=>{if(++checks===3)writeFileSync(appeared,'external new file');})).rejects.toBeInstanceOf(ExportConflict);expect(await readFile(appeared,'utf8')).toBe('external new file');
  await symlink(path,join(dir,'link.csv'));await expect(writePurchaseExport(join(dir,'link.csv'),'csv',bytes,async()=>true)).rejects.toThrow();await expect(writePurchaseExport(join(dir,'wrong.xlsx'),'csv',bytes,async()=>true)).rejects.toThrow();expect(await readFile(path,'utf8')).toBe('external edit');
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('validates caller before dialogs, separates cancel/error, guards duplicate saves and freezes the reviewed snapshot',async()=>{
 let finish!:(yes:boolean)=>void;const review=vi.fn(()=>new Promise<boolean>(r=>{finish=r;})),generate=vi.fn(async(_request:PurchaseExportRequest)=>Buffer.from('\ufeffvalid')),pick=vi.fn(async()=>undefined),confirm=vi.fn(async()=>true);
 const h=createPurchaseExportHandler(wc,url,{review,generate,pick,confirm});
 expect(await h.handle({sender:{},senderFrame:frame},request)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.handle(event,{...request,path:'/bad'})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(review).not.toHaveBeenCalled();
 const mutable={...request,items:[{...item}]},pending=h.handle(event,mutable);mutable.items[0].name='changed after review';expect(await h.handle(event,request)).toMatchObject({ok:false});finish(true);expect(await pending).toEqual({ok:true,data:{status:'canceled'}});expect(generate.mock.calls[0][0].items[0].name).toBe('합성 품목');
 const failure=createPurchaseExportHandler(wc,url,{review:async()=>true,generate:async()=>{throw Error('secret cell');},pick,confirm});const result=await failure.handle(event,request);expect(result).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});expect(JSON.stringify(result)).not.toContain('secret');
});
it('runs real CSV/XLSX output CLI, validates bytes and saves selected files without changing source/session state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'purchase-export-cli-')),root=resolve('tools/purchase-excel-cli'),name=process.platform==='win32'?'purchase-excel-cli.exe':'purchase-excel-cli',exe=existsSync(join(root,'target/debug',name))?join(root,'target/debug',name):resolve('build/purchase-excel-cli',name),service=new ExcelService(exe,join(dir,'temp'));
 try{
  for(const format of ['csv','xlsx'] as const){const r=validatePurchaseExport({...request,format}),bytes=await service.generateExport(r,new AbortController().signal);expect(bytes.length).toBeGreaterThan(20);const path=join(dir,`synthetic.${format}`);const h=createPurchaseExportHandler(wc,url,{review:async()=>true,generate:(r,s)=>service.generateExport(r,s),pick:async()=>path,confirm:async()=>true});expect(await h.handle(event,r)).toMatchObject({ok:true,data:{status:'saved'}});const saved=await readFile(path);if(format==='csv')expect(saved).toEqual(bytes);else expect(saved.subarray(0,4)).toEqual(Buffer.from([80,75,3,4]));}
  expect(item.name).toBe('합성 품목');await service.flush();
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('cancels outstanding native dialogs without allowing a late choice to write and waits for CLI cancellation',async()=>{
 let answer!:(yes:boolean)=>void;const generate=vi.fn(async()=>Buffer.from('unused')),pick=vi.fn(async()=>undefined),confirm=vi.fn(async()=>true);
 const h=createPurchaseExportHandler(wc,url,{review:()=>new Promise(r=>{answer=r;}),generate,pick,confirm});const pending=h.handle(event,request);h.dispose();await h.flush();expect(await pending).toEqual({ok:true,data:{status:'canceled'}});answer(true);await Promise.resolve();expect(generate).not.toHaveBeenCalled();expect(pick).not.toHaveBeenCalled();
 let finished!:(bytes:Buffer)=>void;let signal:AbortSignal|undefined;const active=createPurchaseExportHandler(wc,url,{review:async()=>true,generate:(_r,s)=>{signal=s;return new Promise(r=>{finished=r;});},pick,confirm});const job=active.handle(event,request);await vi.waitFor(()=>expect(signal).toBeTruthy());active.dispose();expect(signal?.aborted).toBe(true);finished(Buffer.from('unused'));expect(await job).toEqual({ok:true,data:{status:'canceled'}});expect(pick).not.toHaveBeenCalled();
});

it('keeps the original UTC YYYYMMDD default filename contract',()=>{expect(purchaseExportFileName('csv',new Date('2026-01-02T00:00:00Z'))).toBe('품의_품목내역_20260102.csv');expect(purchaseExportFileName('xlsx',new Date('2026-12-31T23:59:59Z'))).toBe('품의_품목내역_20261231.xlsx');});
