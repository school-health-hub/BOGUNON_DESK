// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {PurchaseSession} from '../renderer/purchase/PurchaseSession';
import {createPurchaseImportHandlers} from '../main/purchase-import';
const url='file:///p0/index.html',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function edit(label:string,value:string){const input=screen.getByLabelText(label);fireEvent.focus(input);fireEvent.change(input,{target:{value}});fireEvent.keyDown(input,{key:'Enter'});fireEvent.blur(input);}
function manual(){fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));edit('1행 품명','합성 수동');edit('1행 수량','1');edit('1행 단가','10');}
function setup(csv='품명,수량,단가\n합성 CSV,2,100'){
 const select=vi.fn(async()=>'/isolated/synthetic.csv'),h=createPurchaseImportHandlers(wc,url,select,async()=>Buffer.from(csv));
 vi.stubGlobal('electronWork',{purchase:{pickCsv:()=>h.pick(event),cancelCsv:()=>h.cancel(event),mapCsv:(r:unknown)=>h.map(event,r),copy:async()=>({ok:true,data:null})}});
 return {select,...render(<PurchaseSession open onClose={vi.fn()}/>)};
}
it('selects only after an explicit click, previews then merges with unique session IDs without changing a manual item',async()=>{
 const {select}=setup();manual();expect(select).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByRole('button',{name:'CSV 품목 적용'});
 expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 수동');expect(screen.queryByLabelText('2행 품명')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'CSV 품목 적용'}));expect((screen.getByLabelText('2행 품명') as HTMLInputElement).value).toBe('합성 CSV');expect(screen.getByText('2개 선택 · 210원')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'CSV 품목 적용'})).toBeNull();
});
it('requires replacement confirmation and preserves manual items and draft on declined confirmation',async()=>{
 setup();manual();fireEvent.click(screen.getByRole('tab',{name:'품의문 작성'}));fireEvent.click(screen.getByRole('button',{name:'품의문 초안 만들기'}));
 fireEvent.change(screen.getByLabelText('품의 제목'),{target:{value:'합성 보존 초안'}});fireEvent.click(screen.getByRole('tab',{name:'품목내역'}));
 fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByRole('button',{name:'CSV 품목 적용'});fireEvent.change(screen.getByLabelText('CSV 적용 방식'),{target:{value:'replace'}});
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:'CSV 품목 적용'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 수동');
 fireEvent.click(screen.getByRole('tab',{name:'품의문 작성'}));expect((screen.getByLabelText('품의 제목') as HTMLInputElement).value).toBe('합성 보존 초안');
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'CSV 품목 적용'}));fireEvent.click(screen.getByRole('tab',{name:'품목내역'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 CSV');
 fireEvent.click(screen.getByRole('tab',{name:'품의문 작성'}));expect(screen.getByRole('button',{name:'품의문 초안 만들기'})).toBeTruthy();
});
it('maps unknown headers against main-owned rows before applying to the original table',async()=>{
 setup('대상,개입,예상값\n합성 매핑,3,25');fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByRole('dialog',{name:'CSV 열 지정'});
 for(const [field,value] of [['품명','0'],['수량','1'],['단가','2']])fireEvent.change(screen.getByLabelText(`${field}에 연결할 원본 열`),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'CSV 열 연결 확인'}));await screen.findByRole('button',{name:'CSV 품목 적용'});fireEvent.click(screen.getByRole('button',{name:'CSV 품목 적용'}));expect(screen.getByText('1개 선택 · 75원')).toBeTruthy();
});
it('blocks stale analyses after edits and preserves items on malformed CSV',async()=>{
 const view=setup();manual();fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByRole('button',{name:'CSV 품목 적용'});edit('1행 품명','합성 변경');fireEvent.click(screen.getByRole('button',{name:'CSV 품목 적용'}));await screen.findByText(/분석 후 품목이 변경/);expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 변경');expect(screen.queryByLabelText('2행 품명')).toBeNull();
 view.unmount();setup('"broken');manual();fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByText(/CSV를 분석하지 못했습니다/);expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 수동');
});
it('ignores a pending result after cancel, closure or intervening manual edits',async()=>{
 let resolve!:(value:unknown)=>void;const cancel=vi.fn(async()=>({ok:true,data:null}));
 vi.stubGlobal('electronWork',{purchase:{pickCsv:()=>new Promise(r=>{resolve=r;}),cancelCsv:cancel}});
 const view=render(<PurchaseSession open onClose={vi.fn()}/>);manual();fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));fireEvent.click(screen.getByRole('button',{name:'CSV 분석 취소'}));resolve({ok:true,data:{generation:1,result:{items:[],sources:[],candidates:[]}}});await waitFor(()=>expect(screen.queryByRole('group',{name:'CSV 적용 확인'})).toBeNull());
 fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));edit('1행 품명','합성 변경');resolve({ok:true,data:{generation:2,result:{items:[],sources:[],candidates:[]}}});await screen.findByText(/선택 중 품목이 변경/);
 fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));view.rerender(<PurchaseSession open={false} onClose={vi.fn()}/>);resolve({ok:true,data:{generation:3,result:{items:[],sources:[],candidates:[]}}});view.rerender(<PurchaseSession open onClose={vi.fn()}/>);expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 변경');expect(cancel).toHaveBeenCalled();
});
