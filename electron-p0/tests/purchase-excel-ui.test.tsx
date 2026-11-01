// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,fireEvent,cleanup} from '@testing-library/react';import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {mkdtemp,rm} from 'node:fs/promises';import {existsSync} from 'node:fs';
import {PurchaseSession} from '../renderer/purchase/PurchaseSession';import {ExcelService} from '../main/purchase-excel';import {createExcelHandlers} from '../main/purchase-excel-ipc';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('connects Excel format selection to real CLI analysis, preserves manual items and applies only after confirmation',async()=>{
 const root=resolve('tools/purchase-excel-cli'),name=process.platform==='win32'?'purchase-excel-cli.exe':'purchase-excel-cli',exe=(existsSync(join(root,'target/debug',name))?join(root,'target/debug',name):resolve('build/purchase-excel-cli',name)),dir=await mkdtemp(join(tmpdir(),'excel-ui-'));
 const frame={},url='file:///p0',wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};const service=new ExcelService(exe,dir),select=vi.fn(async()=>join(root,'target/qa-fixtures/synthetic.xlsx')),h=createExcelHandlers(wc,url,select,service);
 vi.stubGlobal('electronWork',{purchase:{cancelCsv:async()=>({ok:true,data:null}),pickExcel:()=>h.pick(event),cancelExcel:()=>h.cancel(event),mapExcel:(r:unknown)=>h.map(event,r)}});
 try{
  render(<PurchaseSession open onClose={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));fireEvent.change(screen.getByLabelText('가져오기 형식'),{target:{value:'excel'}});expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Excel 가져오기'}));await screen.findByRole('button',{name:'Excel 품목 적용'});expect(screen.queryByLabelText('2행 품명')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Excel 품목 적용'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('');expect((screen.getByLabelText('2행 품명') as HTMLInputElement).value).toBe('합성 품목');expect((screen.getByLabelText('3행 품명') as HTMLInputElement).value).toBe('합성 품목');
  cleanup();h.dispose();await service.flush();
 }finally{await rm(dir,{recursive:true,force:true});}
});
