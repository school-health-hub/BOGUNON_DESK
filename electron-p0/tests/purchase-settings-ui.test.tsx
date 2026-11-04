// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {PurchaseSession} from '../renderer/purchase/PurchaseSession';
import type {PurchaseSettingsDocument} from '../purchase-settings-protocol';
import {defaultPurchaseDraftTemplate} from '../renderer/purchase/purchase/purchaseDraft';
import {defaultPurchaseOutputColumns} from '../renderer/purchase/purchase/types';
import {createPurchaseImportHandlers} from '../main/purchase-import';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const draft={...defaultPurchaseDraftTemplate,id:'draft-template-synthetic',name:'합성 저장 양식'};
function setup(seed?:Partial<PurchaseSettingsDocument>){
 let document:PurchaseSettingsDocument={version:1,revision:0,draftTemplates:[],importTemplates:[],outputColumns:defaultPurchaseOutputColumns,...seed};
 const save=vi.fn(async(next:PurchaseSettingsDocument,revision:number)=>{if(revision!==document.revision)throw Error('conflict');document=JSON.parse(JSON.stringify({...next,revision:revision+1}));return {ok:true as const,data:{document,recovered:false}};});
 const settings={load:vi.fn(async()=>({ok:true as const,data:{document,recovered:false}})),save};
 const url='file:///qa',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
 const h=createPurchaseImportHandlers(wc,url,async()=>'/isolated/synthetic.csv',async()=>Buffer.from('대상,개입,예상값\n합성 매핑,3,25'));
 const copy=vi.fn(async()=>({ok:true,data:null}));
 vi.stubGlobal('electronWork',{purchase:{settings,pickCsv:()=>h.pick(event),cancelCsv:()=>h.cancel(event),mapCsv:(r:unknown)=>h.map(event,r),pickExcel:()=>h.pick(event),cancelExcel:()=>h.cancel(event),mapExcel:(r:unknown)=>h.map(event,r),copy}});
 return {settings,save,copy,get document(){return document;}};
}
async function ready(){await screen.findByText('Purchase 설정을 이 PC에서 불러왔습니다.');}
function edit(label:string,value:string){const input=screen.getByLabelText(label);fireEvent.focus(input);fireEvent.change(input,{target:{value}});fireEvent.keyDown(input,{key:'Enter'});fireEvent.blur(input);}
function manual(){fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));edit('1행 품명','합성 원본 품목');edit('1행 수량','2');edit('1행 단가','100');}
function openDraft(){manual();fireEvent.click(screen.getByRole('tab',{name:'품의문 작성'}));fireEvent.click(screen.getByRole('button',{name:'품의문 초안 만들기'}));fireEvent.change(screen.getByLabelText('품의 제목'),{target:{value:'보존할 합성 원고'}});}

it('saves a template after acknowledgement and restores it on remount without persisting items/draft',async()=>{
 const api=setup(),view=render(<PurchaseSession open onClose={vi.fn()}/>);await ready();expect(screen.getByLabelText('Purchase 설정 상태').closest('[role="dialog"]')).toBeTruthy();openDraft();
 fireEvent.click(screen.getByRole('button',{name:'템플릿 저장'}));fireEvent.change(screen.getByLabelText('품의문 템플릿 이름'),{target:{value:'합성 새 양식'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));await screen.findByText('품의문 템플릿을 저장했습니다.');
 expect(api.document.draftTemplates[0].name).toBe('합성 새 양식');expect((screen.getByLabelText('품의 제목') as HTMLInputElement).value).toBe('보존할 합성 원고');expect((screen.getByLabelText('품의문 템플릿') as HTMLSelectElement).value).toBe('default');
 expect(Object.keys(api.save.mock.calls[0][0]).sort()).toEqual(['draftTemplates','importTemplates','outputColumns','revision','version']);
 view.unmount();render(<PurchaseSession open onClose={vi.fn()}/>);await ready();expect(screen.queryByLabelText('1행 품명')).toBeNull();openDraft();expect(screen.getByRole('option',{name:'합성 새 양식'})).toBeTruthy();
});
it('updates/deletes selected templates only after confirmation while preserving current draft format and text',async()=>{
 const api=setup({draftTemplates:[draft]});render(<PurchaseSession open onClose={vi.fn()}/>);await ready();openDraft();fireEvent.change(screen.getByLabelText('품의문 템플릿'),{target:{value:draft.id}});
 fireEvent.click(screen.getByRole('button',{name:'템플릿 저장'}));fireEvent.change(screen.getByLabelText('품의문 제목 형식'),{target:{value:'[합성] {{title}}'}});fireEvent.change(screen.getByLabelText('품의문 템플릿 이름'),{target:{value:'합성 수정 양식'}});
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:'선택 템플릿 수정 저장'}));expect(api.save).not.toHaveBeenCalled();confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'선택 템플릿 수정 저장'}));await screen.findByText('품의문 템플릿을 수정했습니다.');expect(api.document.draftTemplates[0]).toMatchObject({name:'합성 수정 양식',titlePattern:'[합성] {{title}}'});
 fireEvent.click(screen.getByLabelText('합성 수정 양식 템플릿 삭제'));await waitFor(()=>expect(api.document.draftTemplates).toEqual([]));expect((screen.getByLabelText('품의 제목') as HTMLInputElement).value).toBe('보존할 합성 원고');expect(screen.getByLabelText('품의문 미리보기').textContent).toContain('[합성] 보존할 합성 원고');
});
it('persists output selection/order on acknowledgement, restores it and keeps a canceled edit out of storage',async()=>{
 const api=setup(),view=render(<PurchaseSession open onClose={vi.fn()}/>);await ready();
 fireEvent.click(screen.getByRole('button',{name:'출력 컬럼 설정'}));fireEvent.click(screen.getByLabelText('번호'));fireEvent.click(screen.getByLabelText('비고 왼쪽 이동'));fireEvent.click(screen.getByRole('button',{name:'취소'}));expect(api.save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'출력 컬럼 설정'}));fireEvent.click(screen.getByLabelText('번호'));fireEvent.click(screen.getByLabelText('비고 왼쪽 이동'));fireEvent.click(screen.getByRole('button',{name:'저장'}));await waitFor(()=>expect(api.document.outputColumns).toEqual(['name','specification','quantity','unitPrice','note','amount']));
 view.unmount();render(<PurchaseSession open onClose={vi.fn()}/>);await ready();manual();fireEvent.click(screen.getByRole('button',{name:'표 복사'}));await waitFor(()=>expect(api.copy).toHaveBeenCalled());const content=api.copy.mock.calls[0] as unknown as [{text:string}];expect(content[0].text.split(/\r?\n/)[0]).toBe('품명\t규격\t수량\t단가\t비고\t금액');
});
it('preserves current items/draft on canceled or confirmed settings reset',async()=>{
 const api=setup({draftTemplates:[draft]});render(<PurchaseSession open onClose={vi.fn()}/>);await ready();openDraft();fireEvent.click(screen.getByRole('button',{name:'가져오기 설정'}));const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 fireEvent.click(screen.getByRole('button',{name:'Purchase 설정 초기화'}));expect(api.save).not.toHaveBeenCalled();confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Purchase 설정 초기화'}));await waitFor(()=>expect(api.document.draftTemplates).toEqual([]));expect((screen.getByLabelText('품의 제목') as HTMLInputElement).value).toBe('보존할 합성 원고');fireEvent.click(screen.getByRole('tab',{name:'품목내역'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 원본 품목');
});
it('keeps failed template/column changes editable and never announces a failed write as saved',async()=>{
 const api=setup();api.save.mockRejectedValue(Error('합성 쓰기 실패'));render(<PurchaseSession open onClose={vi.fn()}/>);await ready();
 fireEvent.click(screen.getByRole('button',{name:'출력 컬럼 설정'}));fireEvent.click(screen.getByLabelText('번호'));fireEvent.click(screen.getByRole('button',{name:'저장'}));await screen.findByText('합성 쓰기 실패');expect(screen.getByRole('button',{name:'저장'})).toBeTruthy();expect(api.document.outputColumns).toEqual(defaultPurchaseOutputColumns);fireEvent.click(screen.getByRole('button',{name:'취소'}));
 openDraft();fireEvent.click(screen.getByRole('button',{name:'템플릿 저장'}));fireEvent.change(screen.getByLabelText('품의문 템플릿 이름'),{target:{value:'합성 실패 양식'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(2));expect(api.document.draftTemplates).toEqual([]);expect(screen.queryByText('품의문 템플릿을 저장했습니다.')).toBeNull();expect((screen.getByLabelText('품의 제목') as HTMLInputElement).value).toBe('보존할 합성 원고');
});
it('saves CSV mapping separately, restores matching templates and preserves items until explicit apply',async()=>{
 const api=setup(),view=render(<PurchaseSession open onClose={vi.fn()}/>);await ready();manual();fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByRole('dialog',{name:'CSV 열 지정'});
 for(const [field,value] of [['품명','0'],['수량','1'],['단가','2']])fireEvent.change(screen.getByLabelText(`${field}에 연결할 원본 열`),{target:{value}});
 fireEvent.click(screen.getByLabelText('이 열 구성을 기억하기'));fireEvent.change(screen.getByLabelText('가져오기 템플릿 이름'),{target:{value:'합성 매핑 양식'}});fireEvent.click(screen.getByRole('button',{name:'CSV 열 연결 확인'}));await screen.findByRole('button',{name:'CSV 품목 적용'});expect(api.document.importTemplates[0]).toMatchObject({name:'합성 매핑 양식',mapping:{name:0,quantity:1,unitPrice:2}});expect(screen.queryByLabelText('2행 품명')).toBeNull();
 view.unmount();render(<PurchaseSession open onClose={vi.fn()}/>);await ready();fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByRole('dialog',{name:'CSV 열 지정'});fireEvent.change(screen.getByLabelText('저장된 가져오기 템플릿'),{target:{value:api.document.importTemplates[0].id}});expect((screen.getByLabelText('품명에 연결할 원본 열') as HTMLSelectElement).value).toBe('0');expect((screen.getByLabelText('단가에 연결할 원본 열') as HTMLSelectElement).value).toBe('2');fireEvent.click(screen.getByRole('button',{name:'열 지정 닫기'}));expect(screen.queryByLabelText('1행 품명')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'가져오기 설정'}));vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByLabelText('합성 매핑 양식 열 설정 삭제'));expect(api.document.importTemplates).toHaveLength(1);
});
it('blocks setting writes after a load error while preserving normal item editing',async()=>{
 const api=setup();api.settings.load.mockRejectedValue(Error('합성 손상 파일'));render(<PurchaseSession open onClose={vi.fn()}/>);await screen.findByText('합성 손상 파일');manual();expect((screen.getByRole('button',{name:'출력 컬럼 설정'}) as HTMLButtonElement).disabled).toBe(true);expect(api.save).not.toHaveBeenCalled();expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 원본 품목');
});
it('does not announce success or alter settings before a pending Main write completes',async()=>{
 const api=setup();let finish!:(value:Awaited<ReturnType<typeof api.save>>)=>void;
 api.save.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 render(<PurchaseSession open onClose={vi.fn()}/>);await ready();openDraft();fireEvent.click(screen.getByRole('button',{name:'템플릿 저장'}));fireEvent.change(screen.getByLabelText('품의문 템플릿 이름'),{target:{value:'합성 대기 양식'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));
 expect(screen.queryByText('품의문 템플릿을 저장했습니다.')).toBeNull();expect((screen.getByRole('button',{name:'저장'}) as HTMLButtonElement).disabled).toBe(true);expect(api.document.draftTemplates).toEqual([]);
 finish({ok:true,data:{document:{...api.document,revision:1,draftTemplates:[draft]},recovered:false}});await screen.findByText('품의문 템플릿을 저장했습니다.');expect((screen.getByLabelText('품의 제목') as HTMLInputElement).value).toBe('보존할 합성 원고');
});
it('reuses a stored header mapping through the Excel bridge without auto-applying any item',async()=>{
 const api=setup({importTemplates:[{id:'import-template-excel',name:'합성 Excel 열',headerSignature:['대상','개입','예상값'],mapping:{name:0,quantity:1,unitPrice:2}}]});render(<PurchaseSession open onClose={vi.fn()}/>);await ready();manual();
 fireEvent.change(screen.getByLabelText('가져오기 형식'),{target:{value:'excel'}});fireEvent.click(screen.getByRole('button',{name:'Excel 가져오기'}));await screen.findByRole('dialog',{name:'Excel 열 지정'});fireEvent.change(screen.getByLabelText('저장된 가져오기 템플릿'),{target:{value:'import-template-excel'}});fireEvent.click(screen.getByRole('button',{name:'Excel 열 연결 확인'}));await screen.findByRole('button',{name:'Excel 품목 적용'});
 expect(screen.queryByLabelText('2행 품명')).toBeNull();expect(api.save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Excel 품목 적용'}));expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 원본 품목');expect((screen.getByLabelText('2행 품명') as HTMLInputElement).value).toBe('합성 매핑');
});
it('keeps a backup-derived profile read-only without overwriting it through reset',async()=>{
 const api=setup({draftTemplates:[draft]});api.settings.load.mockResolvedValue({ok:true,data:{document:api.document,recovered:true}});
 render(<PurchaseSession open onClose={vi.fn()}/>);await screen.findByText(/백업 설정을 읽었습니다/);expect((screen.getByRole('button',{name:'출력 컬럼 설정'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'가져오기 설정'}) as HTMLButtonElement).disabled).toBe(true);expect(api.save).not.toHaveBeenCalled();
});
it('confirms mapping template replacement/deletion and retains the old mapping when confirmation is canceled',async()=>{
 const api=setup({importTemplates:[{id:'import-template-existing',name:'합성 기존 열',headerSignature:['대상','개입','예상값'],mapping:{name:0,quantity:1,unitPrice:2}}]});render(<PurchaseSession open onClose={vi.fn()}/>);await ready();
 fireEvent.click(screen.getByRole('button',{name:'CSV 가져오기'}));await screen.findByRole('dialog',{name:'CSV 열 지정'});fireEvent.change(screen.getByLabelText('저장된 가져오기 템플릿'),{target:{value:'import-template-existing'}});fireEvent.change(screen.getByLabelText('수량에 연결할 원본 열'),{target:{value:''}});fireEvent.click(screen.getByLabelText('이 열 구성을 기억하기'));fireEvent.change(screen.getByLabelText('가져오기 템플릿 이름'),{target:{value:'합성 수정 열'}});
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:'CSV 열 연결 확인'}));await waitFor(()=>expect(confirm).toHaveBeenCalled());expect(api.save).not.toHaveBeenCalled();expect(api.document.importTemplates[0].mapping.quantity).toBe(1);
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'CSV 열 연결 확인'}));await waitFor(()=>expect(api.document.importTemplates[0].name).toBe('합성 수정 열'));expect(api.document.importTemplates).toHaveLength(1);expect(api.document.importTemplates[0].id).toBe('import-template-existing');expect(api.document.importTemplates[0].mapping.quantity).toBeUndefined();
 // A mapping may need item review; closing never applies its rows to the current list.
 if(screen.queryByRole('button',{name:'열 지정 닫기'}))fireEvent.click(screen.getByRole('button',{name:'열 지정 닫기'}));else if(screen.queryByRole('button',{name:'CSV 분석 취소'}))fireEvent.click(screen.getByRole('button',{name:'CSV 분석 취소'}));
 expect(screen.queryByLabelText('1행 품명')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'가져오기 설정'}));fireEvent.click(screen.getByLabelText('합성 수정 열 열 설정 삭제'));await waitFor(()=>expect(api.document.importTemplates).toEqual([]));
});
