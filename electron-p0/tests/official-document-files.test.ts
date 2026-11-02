import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {OfficialDocumentService,createOfficialDocumentHandlers,saveNewOdt,validateDocument} from '../main/official-document-files';
const document={title:'합성 안내',body:'합성 본문입니다.  끝.',attachments:'',hasTableText:false};
const frame={},wc={mainFrame:frame,getURL:()=> 'file:///official'},event={sender:wc,senderFrame:frame};
it('imports synthetic PDF/HWPX/ODT with the real fixed CLI and exports/reimports approved ODT',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'od-files-'));const service=new OfficialDocumentService(resolve('tools/official-document-cli/target/debug',process.platform==='win32'?'official-document-cli.exe':'official-document-cli'),join(dir,'private'));
 try{for(const format of ['pdf','hwpx','odt']){const r=await service.import(resolve(`tools/official-document-cli/tests/fixtures/synthetic-document.${format}`),new AbortController().signal);expect(r.format).toBe(format);expect(r.sourceName).toBe(`synthetic-document.${format}`);expect(r.text).toContain(format==='pdf'?'Synthetic':'합성');}
 const bytes=await service.generate(document,new AbortController().signal),path=join(dir,'합성.odt');await saveNewOdt(path,bytes,()=>{});expect((await service.import(path,new AbortController().signal)).text).toContain('합성 안내');expect(await readdir(join(dir,'private'))).toEqual([]);
 await expect(service.generate({...document,hasTableText:true},new AbortController().signal)).rejects.toThrow();
 await expect(service.generate({...document,body:'끝 표식 없음'},new AbortController().signal)).rejects.toThrow();
 }finally{await service.flush();await rm(dir,{recursive:true,force:true});}
});
it('never overwrites an original, preserves it after cancellation/failure and removes staging files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'od-save-')),path=join(dir,'original.odt'),bytes=Buffer.from('synthetic');
 try{await writeFile(path,'original');await expect(saveNewOdt(path,bytes,()=>{})).rejects.toThrow();expect(await readFile(path,'utf8')).toBe('original');
 await expect(saveNewOdt(join(dir,'cancel.odt'),bytes,()=>{throw Error('cancel');})).rejects.toThrow();expect(await readdir(dir)).toEqual(['original.odt']);
 const fresh=vi.fn();fresh.mockImplementationOnce(()=>{}).mockImplementationOnce(()=>{throw Error('failure before publication');});await expect(saveNewOdt(join(dir,'fail.odt'),bytes,fresh)).rejects.toThrow();expect(await readdir(dir)).toEqual(['original.odt']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('rejects caller/renderer path/forged fields; cancels native selection and obsolete work without writing',async()=>{
 let select!:(p:string|undefined)=>void;const service={import:vi.fn(async()=>({sourceName:'x.odt',format:'odt' as const,text:'합성'})),generate:vi.fn(async()=>Buffer.from('synthetic'))};
 const ports={service,pick:()=>new Promise<string|undefined>(r=>{select=r;}),save:vi.fn(async()=>undefined),review:vi.fn(async()=>true),write:vi.fn(async()=> 'x.odt')};const h=createOfficialDocumentHandlers(wc,'file:///official',ports);
 expect(await h.pick({sender:{},senderFrame:frame})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.pick(event,'arbitrary')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(()=>validateDocument({...document,path:'/secret'})).toThrow();
 const waiting=h.pick(event);h.cancel(event);select('/unused');expect(await waiting).toEqual({ok:true,data:null});expect(service.import).not.toHaveBeenCalled();
 const cancel=h.pick(event);select(undefined);expect(await cancel).toEqual({ok:true,data:null});
 expect(await h.save(event,document)).toEqual({ok:true,data:null});expect(ports.write).not.toHaveBeenCalled();h.dispose();
});
it('does not call storage after rejection or canceled generation',async()=>{
 let finish!:(b:Buffer)=>void;const service={import:vi.fn(),generate:()=>new Promise<Buffer>(r=>{finish=r;})},write=vi.fn();const h=createOfficialDocumentHandlers(wc,'file:///official',{service,pick:async()=>undefined,save:async()=>'/unused.odt',review:async()=>true,write});
 const p=h.save(event,document);await Promise.resolve();h.cancel(event);finish(Buffer.from('synthetic'));expect(await p).toEqual({ok:true,data:null});expect(write).not.toHaveBeenCalled();
});
