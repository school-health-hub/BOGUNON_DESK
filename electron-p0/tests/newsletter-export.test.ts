import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
vi.mock('electron',()=>({BrowserWindow:vi.fn(),session:{},nativeImage:{createFromBuffer:()=>{throw Error('PNG decoding requires actual Electron');}}}));
import {validateExportRequest,createNewsletterExportHandler,validateGeneratedFiles} from '../main/newsletter-export';
import {saveGeneratedExport} from '../main/newsletter-export-storage';
const request={document:JSON.stringify({project:{schemaVersion:1,projectId:'synthetic',projectRevision:1,revisionHistory:[]},design:{projectId:'synthetic',designSchemaVersion:2,designRevision:1,canonicalProjectRevision:1,revisionHistory:[]}}),selection:'a4-pdf' as const,assets:[]};
it('rejects paths, raw output bytes, QA mode, bad format, size, duplicate assets and non-base64 input',()=>{
 for(const bad of [null,{...request,path:'C:/any'},{...request,bytesBase64:'UE5H'},{...request,purpose:'qa'},{...request,selection:'exe'},{...request,document:'x'.repeat(8*1024*1024+1)},{...request,assets:[{reference:'asset:'+'a'.repeat(64),bytesBase64:'!!!'}]}])expect(()=>validateExportRequest(bad)).toThrow();
 const a={reference:'asset:'+'a'.repeat(64),bytesBase64:'AQ=='};expect(()=>validateExportRequest({...request,assets:[a,a]})).toThrow();expect(validateExportRequest(request)).toEqual(request);
});
it('denies unauthorized frame/window/URL and authority failure before grant or picker',async()=>{
 const frame={},wc={mainFrame:frame,getURL:()=> 'file:///test'},event={sender:wc,senderFrame:frame};
 const ports={generate:vi.fn(async()=>{throw Error('SYNTHETIC APPROVAL FAILURE');}),approve:vi.fn(),pick:vi.fn(),confirm:vi.fn()};
 const h=createNewsletterExportHandler(wc,'file:///test',ports);
 for(const e of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}}])expect(await h(e,request)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 const other={...wc,getURL:()=> 'https://evil.invalid'};expect(await createNewsletterExportHandler(other,'file:///test',ports)({sender:other,senderFrame:frame},request)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(ports.generate).not.toHaveBeenCalled();
 const r=await h(event,request);expect(r).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(JSON.stringify(r)).not.toContain('SYNTHETIC');expect(ports.approve).not.toHaveBeenCalled();expect(ports.pick).not.toHaveBeenCalled();
});
it('saves parseable PDF with explicit overwrite and preserves original bytes on cancellation/fault/change',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([100,100]);const bytes=Buffer.from(await pdf.save());
 const output={summary:'synthetic',files:[{fileName:'newsletter-a4.pdf',bytesBase64:bytes.toString('base64')}]};const files=validateGeneratedFiles(output,'a4-pdf');
 const dir=await mkdtemp(join(tmpdir(),'newsletter-export-')),path=join(dir,'synthetic.pdf');await writeFile(path,'SYNTHETIC ORIGINAL');
 expect(await saveGeneratedExport(files,'a4-pdf',path,async()=>false)).toEqual({saved:false});expect(await readFile(path,'utf8')).toBe('SYNTHETIC ORIGINAL');
 await expect(saveGeneratedExport(files,'a4-pdf',path,async()=>true,async()=>{throw Error('FAULT');})).rejects.toThrow();expect(await readFile(path,'utf8')).toBe('SYNTHETIC ORIGINAL');expect(await readdir(dir)).toEqual(['synthetic.pdf']);
 await expect(saveGeneratedExport(files,'a4-pdf',path,async()=>{await writeFile(path,'SYNTHETIC CONCURRENT');return true;})).rejects.toThrow();expect(await readFile(path,'utf8')).toBe('SYNTHETIC CONCURRENT');
 expect((await saveGeneratedExport(files,'a4-pdf',path,async()=>true)).saved).toBe(true);expect((await PDFDocument.load(await readFile(path))).getPageCount()).toBe(1);
 expect(()=>validateGeneratedFiles({...output,files:[{...output.files[0],fileName:'../other.pdf'}]},'a4-pdf')).toThrow();
 await expect(saveGeneratedExport(files,'a4-pdf',join(dir,'bad.exe'),async()=>true)).rejects.toThrow();
});
it('publishes card set only in a fresh folder and leaves existing files untouched on failed publication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'newsletter-cards-'));await writeFile(join(dir,'01-card-cover.png'),'SYNTHETIC EXISTING');
 const files=[{fileName:'01-card-cover.png',bytes:Buffer.from('SYNTHETIC GENERATED')}];
 await expect(saveGeneratedExport(files,'card-pngs',dir,async()=>true,async()=>{throw Error('FAULT');})).rejects.toThrow();expect(await readdir(dir)).toEqual(['01-card-cover.png']);
 const r=await saveGeneratedExport(files,'card-pngs',dir,async()=>true);expect(r.saved).toBe(true);expect(await readFile(join(dir,'01-card-cover.png'),'utf8')).toBe('SYNTHETIC EXISTING');expect(await readFile(join(dir,r.names![0],'01-card-cover.png'),'utf8')).toBe('SYNTHETIC GENERATED');
});
it('cancels at main grant and location selection without touching target',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());const generated={summary:'synthetic',files:[{fileName:'newsletter-a4.pdf',bytesBase64:bytes.toString('base64')}]};
 const frame={},wc={mainFrame:frame,getURL:()=> 'file:///test'},event={sender:wc,senderFrame:frame},pick=vi.fn(async()=>undefined);
 expect(await createNewsletterExportHandler(wc,'file:///test',{generate:async()=>generated,approve:async()=>false,pick,confirm:async()=>true})(event,request)).toEqual({ok:true,data:{saved:false}});expect(pick).not.toHaveBeenCalled();
 expect(await createNewsletterExportHandler(wc,'file:///test',{generate:async()=>generated,approve:async()=>true,pick,confirm:async()=>true})(event,request)).toEqual({ok:true,data:{saved:false}});
});
