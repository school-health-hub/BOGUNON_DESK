// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';import {existsSync} from 'node:fs';
import {PurchaseSession} from '../renderer/purchase/PurchaseSession';import {ExcelService} from '../main/purchase-excel';import {createExcelHandlers} from '../main/purchase-excel-ipc';
const root=resolve('tools/purchase-excel-cli'),name=process.platform==='win32'?'purchase-excel-cli.exe':'purchase-excel-cli',exe=existsSync(join(root,'target/debug',name))?join(root,'target/debug',name):resolve('build/purchase-excel-cli',name);
const frame={},url='file:///p0',wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(file:string){
 const dir=await mkdtemp(join(tmpdir(),'pdf-ui-')),service=new ExcelService(exe,dir),select=vi.fn(async()=>join(root,'target/qa-fixtures',file));
 const h=createExcelHandlers(wc,url,select,{analyze:(p,s)=>service.analyzePdf(p,s),map:(...args)=>service.map(...args)},'PDF');
 vi.stubGlobal('electronWork',{purchase:{cancelCsv:async()=>({ok:true,data:null}),pickPdf:()=>h.pick(event),cancelPdf:()=>h.cancel(event),mapPdf:(r:unknown)=>h.map(event,r)}});
 const view=render(<PurchaseSession open onClose={vi.fn()}/>);return {h,select,dir,service,view,async dispose(){cleanup();h.dispose();await service.flush();await rm(dir,{recursive:true,force:true});}};
}
function edit(label:string,value:string){const input=screen.getByLabelText(label);fireEvent.focus(input);fireEvent.change(input,{target:{value}});fireEvent.keyDown(input,{key:'Enter'});fireEvent.blur(input);}
function manual(){fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));edit('1행 품명','합성 기존');edit('1행 수량','1');edit('1행 단가','10');}
function pick(){fireEvent.change(screen.getByLabelText('가져오기 형식'),{target:{value:'pdf'}});fireEvent.click(screen.getByRole('button',{name:'PDF 가져오기'}));}
it('merges a real text PDF only after apply, keeps manual rows and ignores totals',async()=>{
 const ctx=await setup('synthetic.pdf');try{manual();expect(ctx.select).not.toHaveBeenCalled();pick();await screen.findByRole('button',{name:'PDF 품목 적용'});expect(screen.queryByLabelText('2행 품명')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'PDF 품목 적용'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 기존');expect((screen.getByLabelText('2행 품명') as HTMLInputElement).value).toBe('Synthetic');expect(screen.getByText('2개 선택 · 210원')).toBeTruthy();expect(await readdir(ctx.dir)).toEqual([]);}finally{await ctx.dispose();}
});
it('imports Korean Unicode PDF and requires confirmation for replacement',async()=>{
 const ctx=await setup('korean.pdf');try{manual();pick();await screen.findByRole('button',{name:'PDF 품목 적용'});fireEvent.change(screen.getByLabelText('PDF 적용 방식'),{target:{value:'replace'}});const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:'PDF 품목 적용'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 기존');confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'PDF 품목 적용'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 품목');expect(screen.getByText('1개 선택 · 3,000원')).toBeTruthy();}finally{await ctx.dispose();}
});
it('maps PDF candidates using the same main-owned mapping contract',async()=>{
 const ctx=await setup('unknown.pdf');try{pick();await screen.findByRole('dialog',{name:'PDF 열 지정'});for(const [field,value] of [['품명','0'],['수량','1'],['단가','2']])fireEvent.change(screen.getByLabelText(`${field}에 연결할 원본 열`),{target:{value}});fireEvent.click(screen.getByRole('button',{name:'PDF 열 연결 확인'}));await screen.findByRole('button',{name:'PDF 품목 적용'});fireEvent.click(screen.getByRole('button',{name:'PDF 품목 적용'}));expect(screen.getByText('1개 선택 · 75원')).toBeTruthy();}finally{await ctx.dispose();}
});
for(const [file,phrase] of [['scanned.pdf','OCR'],['encrypted.pdf','암호화'],['damaged.pdf','읽지 못했습니다'],['oversized-pages.pdf','50페이지']])it(`preserves items/files and reports ${file} without a false success`,async()=>{
 const ctx=await setup(file),path=join(root,'target/qa-fixtures',file),before=await readFile(path);try{manual();pick();await screen.findByText(new RegExp(phrase),{selector:".p0-notice"});expect(screen.queryByRole('button',{name:'PDF 품목 적용'})).toBeNull();expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 기존');expect(await readFile(path)).toEqual(before);expect(await readdir(ctx.dir)).toEqual([]);}finally{await ctx.dispose();}
});
it('rejects oversized selected PDFs before CLI processing and clears partial work',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pdf-limit-'));try{const path=join(dir,'oversized.pdf');await writeFile(path,Buffer.alloc(15*1024*1024+1));const service=new ExcelService(exe,join(dir,'temp'));await expect(service.analyzePdf(path,new AbortController().signal)).rejects.toThrow();expect(existsSync(join(dir,'temp'))).toBe(false);}finally{await rm(dir,{recursive:true,force:true});}
});
it('drops canceled and stale PDF results and rejects forged renderer paths',async()=>{
 let finish!:(r:never)=>void;let signal:AbortSignal|undefined;const select=vi.fn(async()=>'/selected.pdf');
 const h=createExcelHandlers(wc,url,select,{analyze:(_p,s)=>{signal=s;return new Promise<never>(r=>{finish=r;});},map:vi.fn()},'PDF');
 expect(await h.pick(event,'/forged.pdf')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(await h.pick({sender:{},senderFrame:frame})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(select).not.toHaveBeenCalled();const pending=h.pick(event);await waitFor(()=>expect(signal).toBeTruthy());await h.cancel(event);expect(signal?.aborted).toBe(true);finish({items:[],sources:[],candidates:[]} as never);expect(await pending).toEqual({ok:true,data:null});
});
