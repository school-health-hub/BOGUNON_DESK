// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';import {PurchaseSession} from '../renderer/purchase/PurchaseSession';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function edit(label:string,value:string){const input=screen.getByLabelText(label);fireEvent.focus(input);fireEvent.change(input,{target:{value}});fireEvent.keyDown(input,{key:'Enter'});fireEvent.blur(input);}
it('previews CSV and XLSX separately and blocks output after an edit until reviewed again',async()=>{
 const exportItems=vi.fn(async()=>({ok:true,data:{status:'saved',fileName:'synthetic.xlsx'}}));
 vi.stubGlobal('electronWork',{purchase:{exportItems,cancelCsv:async()=>({ok:true,data:null})}});
 render(<PurchaseSession open onClose={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));
 edit('1행 품명','=합성 품목');edit('1행 수량','2.5');edit('1행 단가','100.6');
 fireEvent.click(screen.getByRole('button',{name:'출력 미리보기'}));
 const csv=await screen.findByRole('dialog',{name:'품의 CSV 미리보기'});
 expect(within(csv).getByText("'=합성 품목")).toBeTruthy();
 expect(within(csv).getByText('252')).toBeTruthy();
 expect(exportItems).not.toHaveBeenCalled();
 edit('1행 수량','3');
 expect(within(csv).getByRole('alert').textContent).toContain('변경되었습니다');
 const confirm=within(csv).getByRole<HTMLButtonElement>('button',{name:'확인한 내용으로 출력'});
 expect(confirm.disabled).toBe(true);
 fireEvent.click(confirm);expect(exportItems).not.toHaveBeenCalled();
 fireEvent.click(within(csv).getByRole('button',{name:'미리보기 닫기'}));
 fireEvent.change(screen.getByLabelText('미리보기 출력 형식'),{target:{value:'xlsx'}});
 fireEvent.click(screen.getByRole('button',{name:'출력 미리보기'}));
 const xlsx=await screen.findByRole('dialog',{name:'품의 XLSX 미리보기'});
 expect(within(xlsx).getByText('=합성 품목')).toBeTruthy();
 expect(within(xlsx).getByText('302')).toBeTruthy();
 fireEvent.click(within(xlsx).getByRole('button',{name:'확인한 내용으로 출력'}));
 await screen.findByText('XLSX 파일을 저장했습니다: synthetic.xlsx');
 expect(exportItems).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({format:'xlsx',items:[expect.objectContaining({quantity:3})]}));
});
it('enables only CSV/XLSX for valid selected rows and distinguishes saved, canceled and failed exports',async()=>{
 const exportItems=vi.fn().mockResolvedValueOnce({ok:true,data:{status:'saved',fileName:'synthetic.csv'}}).mockResolvedValueOnce({ok:true,data:{status:'canceled'}}).mockResolvedValueOnce({ok:false,error:{code:'CONFLICT',message:'외부에서 파일이 변경되었습니다.',retryable:true}});
 vi.stubGlobal('electronWork',{purchase:{exportItems,cancelCsv:async()=>({ok:true,data:null})}});render(<PurchaseSession open onClose={vi.fn()}/>);
 expect((screen.getByRole('button',{name:'CSV 저장'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));edit('1행 품명','합성 품목');edit('1행 수량','2.5');edit('1행 단가','100.6');fireEvent.click(screen.getByRole('button',{name:'CSV 저장'}));await screen.findByText('CSV 파일을 저장했습니다: synthetic.csv');expect(exportItems.mock.calls[0][0]).toMatchObject({format:'csv',items:[{name:'합성 품목',quantity:2.5,unitPrice:100.6}],columns:['number','name','specification','quantity','unitPrice','amount','note']});
 fireEvent.click(screen.getByRole('button',{name:'XLSX 저장'}));await screen.findByText('파일 저장을 취소했습니다.');expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 품목');fireEvent.click(screen.getByRole('button',{name:'CSV 저장'}));await screen.findByText('외부에서 파일이 변경되었습니다.');expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 품목');
 edit('1행 단가','-1');expect((screen.getByRole('button',{name:'XLSX 저장'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'에듀파인용 Excel'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('tab',{name:'구매결과'}));expect(screen.getByText('입력 오류와 금액 불일치를 먼저 확인해 주세요.')).toBeTruthy();
});
