// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {PurchaseSession} from '../renderer/purchase/PurchaseSession';
import {createEmptyPurchaseItem,updatePurchaseItem,selectedPurchaseTotal} from '../renderer/purchase/purchase/purchaseDomain';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function edit(label:string,value:string){const input=screen.getByLabelText(label);fireEvent.focus(input);fireEvent.change(input,{target:{value}});fireEvent.keyDown(input,{key:'Enter'});fireEvent.blur(input);}
it('reuses source item CRUD/calculation and draft text/HTML copy with session-only state',async()=>{
 const copy=vi.fn(async(_content:{text:string;html:string})=>({ok:true,data:null}));vi.stubGlobal('electronWork',{purchase:{copy,cancelCsv:async()=>({ok:true,data:null})}});
 const storage=vi.spyOn(Storage.prototype,'setItem');
 const view=render(<PurchaseSession open onClose={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));
 expect(screen.getByText('품명 필요 · 수량 확인 · 단가 확인')).toBeTruthy();
 edit('1행 품명','합성 소모품');edit('1행 수량','2.5');edit('1행 단가','100.6');
 const expected=selectedPurchaseTotal([updatePurchaseItem(createEmptyPurchaseItem('synthetic'),{name:'합성 소모품',quantity:2.5,unitPrice:100.6})]);
 expect(expected).toBe(252);expect(screen.getByText(`1개 선택 · ${expected}원`)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'표 복사'}));await waitFor(()=>expect(copy).toHaveBeenCalledTimes(1));expect(copy.mock.calls[0][0]).toMatchObject({html:expect.stringContaining('<table>'),text:expect.stringContaining('합성 소모품')});
 fireEvent.click(screen.getByRole('tab',{name:'품의문 작성'}));fireEvent.click(screen.getByRole('button',{name:'품의문 초안 만들기'}));
 fireEvent.change(screen.getByLabelText('품의 제목'),{target:{value:'합성 구매 품의'}});fireEvent.change(screen.getByLabelText('구매 목적'),{target:{value:'합성 검증 목적'}});
 expect(screen.getByLabelText('품의문 미리보기').textContent).toContain('합성 구매 품의');expect(screen.getByLabelText('품의문 미리보기').textContent).toContain('252');
 fireEvent.click(screen.getByRole('button',{name:'품의문 복사'}));await waitFor(()=>expect(copy).toHaveBeenCalledTimes(2));expect(copy.mock.calls[1][0]).toMatchObject({html:'',text:expect.stringContaining('252')});
 fireEvent.click(screen.getByRole('button',{name:'품의문 + 품목표 복사'}));await waitFor(()=>expect(copy).toHaveBeenCalledTimes(3));expect(copy.mock.calls[2][0]).toMatchObject({html:expect.stringContaining('<p>')});
 fireEvent.click(screen.getByRole('tab',{name:'품목내역'}));edit('1행 단가','-1');expect((screen.getByRole('button',{name:'표 복사'}) as HTMLButtonElement).disabled).toBe(true);
 edit('1행 단가','abc');expect(screen.getByText('단가 확인')).toBeTruthy();edit('1행 단가','');expect((screen.getByRole('button',{name:'표 복사'}) as HTMLButtonElement).disabled).toBe(true);
 edit('1행 단가','10');fireEvent.click(screen.getByLabelText('1행 선택'));expect(screen.getByText('0개 선택 · 0원')).toBeTruthy();
 view.rerender(<PurchaseSession open={false} onClose={vi.fn()}/>);view.rerender(<PurchaseSession open onClose={vi.fn()}/>);expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 소모품');
 fireEvent.click(screen.getByLabelText('1행 삭제'));expect(screen.queryByLabelText('1행 품명')).toBeNull();
 expect(storage).not.toHaveBeenCalled();storage.mockRestore();view.unmount();render(<PurchaseSession open onClose={vi.fn()}/>);expect(screen.queryByLabelText('1행 품명')).toBeNull();
});
it('keeps spreadsheet/PDF output and sync unavailable while enabling explicit CSV selection',()=>{
 vi.stubGlobal('electronWork',{purchase:{cancelCsv:async()=>({ok:true,data:null})}});render(<PurchaseSession open onClose={vi.fn()}/>);
 for(const name of ['가져오기 설정','CSV 저장','XLSX 저장','에듀파인용 Excel'])expect((screen.getByRole('button',{name}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('tab',{name:'구매결과'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByText(/계정 동기화 없음/)).toBeTruthy();expect((screen.getByRole('button',{name:'CSV 가져오기'}) as HTMLButtonElement).disabled).toBe(false);
});
it('reports copy failure and keeps the edited item',async()=>{
 vi.stubGlobal('electronWork',{purchase:{cancelCsv:async()=>({ok:true,data:null}),copy:vi.fn(async()=>({ok:false,error:{code:'INTERNAL_ERROR',message:'실패',retryable:true}}))}});
 render(<PurchaseSession open onClose={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));edit('1행 품명','합성');edit('1행 수량','1');edit('1행 단가','1');fireEvent.click(screen.getByRole('button',{name:'표 복사'}));await screen.findByText('품목내역을 복사하지 못했습니다.');expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성');
});
