// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {InventoryWorkspace} from '../../src/inventory-management/InventoryWorkspace';
import {createSyntheticInventory} from '../../src/inventory-management/model';

const document=createSyntheticInventory('2026-11-02');
const save=vi.fn(async(next:typeof document,_revision?:string|null)=>({ok:true as const,data:{document:next,recovered:false}}));
afterEach(()=>{cleanup();save.mockClear();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('Inventory workspace',()=>{
 it('searches stock and persists a synthetic receive movement',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);
  vi.stubGlobal('electronWork',{inventory:{load:async()=>({ok:true,data:{document,recovered:false}}),save}});
  render(<InventoryWorkspace onClose={()=>{}}/>);await screen.findByRole('heading',{name:'재고 관리'});
  fireEvent.change(screen.getByLabelText('물품 검색'),{target:{value:'장갑'}});expect(screen.getByText('합성 니트릴 장갑')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'합성 니트릴 장갑 선택'}));fireEvent.click(screen.getByRole('button',{name:'입고 기록'}));
  fireEvent.change(screen.getByLabelText('수량'),{target:{value:'5'}});fireEvent.change(screen.getByLabelText('사유'),{target:{value:'합성 입고 확인'}});fireEvent.change(screen.getByLabelText('유효기간'),{target:{value:'2099-12-31'}});fireEvent.click(screen.getByRole('button',{name:'기록 저장'}));
  await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));expect(save.mock.calls[0]?.[0].movements.at(-1)?.kind).toBe('receive');
 });
});

it('starts empty without auto-saving synthetic fixtures and registers/edit/deletes an unused item',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);vi.stubGlobal('electronWork',{inventory:{load:async()=>({ok:true,data:{document:null,recovered:false}}),save}});
 render(<InventoryWorkspace onClose={()=>{}}/>);await screen.findByText('등록된 물품이 없습니다. 물품 등록부터 시작하세요.');expect(save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'물품 등록'}));fireEvent.change(screen.getByLabelText('물품명'),{target:{value:'합성 새 거즈'}});fireEvent.change(screen.getByLabelText('권장 재고'),{target:{value:'5'}});fireEvent.click(screen.getByRole('button',{name:'물품 저장'}));
 await screen.findByRole('button',{name:'합성 새 거즈 선택'});expect(save.mock.calls[0]?.[1]).toBeNull();expect(save.mock.calls[0]?.[0].lots).toEqual([]);
 fireEvent.click(screen.getByRole('button',{name:'물품 수정'}));fireEvent.change(screen.getByLabelText('물품명'),{target:{value:'합성 수정 거즈'}});fireEvent.click(screen.getByRole('button',{name:'물품 저장'}));await screen.findByRole('button',{name:'합성 수정 거즈 선택'});
 fireEvent.click(screen.getByRole('button',{name:'물품 삭제'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(3));expect(save.mock.calls[2]?.[0].items).toEqual([]);
});
it('preserves input/current stock on save failure and blocks writes from recovered backup',async()=>{
 const failed=vi.fn(async()=>({ok:false,error:{code:'STORAGE_ERROR',message:'합성 권한 오류'}}));vi.spyOn(window,'confirm').mockReturnValue(true);vi.stubGlobal('electronWork',{inventory:{load:async()=>({ok:true,data:{document,recovered:false}}),save:failed}});
 const view=render(<InventoryWorkspace onClose={()=>{}}/>);await screen.findByRole('button',{name:'합성 니트릴 장갑 선택'});fireEvent.click(screen.getByRole('button',{name:'합성 니트릴 장갑 선택'}));fireEvent.click(screen.getByRole('button',{name:'폐기 기록'}));fireEvent.change(screen.getByLabelText('수량'),{target:{value:'1'}});fireEvent.change(screen.getByLabelText('사유'),{target:{value:'합성 폐기'}});fireEvent.click(screen.getByRole('button',{name:'기록 저장'}));await screen.findByText(/합성 권한 오류/);expect((screen.getByLabelText('사유') as HTMLInputElement).value).toBe('합성 폐기');expect(screen.queryByText('폐기 1쌍')).toBeNull();
 view.unmount();vi.stubGlobal('electronWork',{inventory:{load:async()=>({ok:true,data:{document,recovered:true}}),save:failed}});render(<InventoryWorkspace onClose={()=>{}}/>);await screen.findByText(/읽기 전용/);expect((screen.getByRole('button',{name:'입고 기록'}) as HTMLButtonElement).disabled).toBe(true);expect(failed).toHaveBeenCalledTimes(1);
});
it('requires purchase confirmation, passes editable name/spec/quantity, and never saves/increases stock',async()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false),onPurchase=vi.fn();vi.stubGlobal('electronWork',{inventory:{load:async()=>({ok:true,data:{document,recovered:false}}),save}});render(<InventoryWorkspace onClose={()=>{}} onPurchase={onPurchase}/>);await screen.findByRole('button',{name:'합성 탄력붕대 선택'});
 fireEvent.click(screen.getByRole('button',{name:'구매 후보에 추가'}));fireEvent.change(screen.getByLabelText('합성 탄력붕대 구매 규격'),{target:{value:'합성 5cm'}});fireEvent.change(screen.getByLabelText('합성 탄력붕대 구매 수량'),{target:{value:'3'}});fireEvent.click(screen.getByRole('button',{name:'확인 후 Purchase에 추가'}));expect(onPurchase).not.toHaveBeenCalled();confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'확인 후 Purchase에 추가'}));expect(onPurchase).toHaveBeenCalledWith([{inventoryItemId:'synthetic-bandage',name:'합성 탄력붕대',specification:'합성 5cm',quantity:3}]);expect(save).not.toHaveBeenCalled();expect(document.movements).toEqual([]);
});
it('keeps current item and inputs when movement confirmation is cancelled',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(false);vi.stubGlobal('electronWork',{inventory:{load:async()=>({ok:true,data:{document,recovered:false}}),save}});render(<InventoryWorkspace onClose={()=>{}}/>);await screen.findByRole('button',{name:'합성 탄력붕대 선택'});fireEvent.click(screen.getByRole('button',{name:'입고 기록'}));fireEvent.change(screen.getByLabelText('수량'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('사유'),{target:{value:'합성 취소'}});fireEvent.change(screen.getByLabelText('유효기간'),{target:{value:'2099-12-31'}});fireEvent.click(screen.getByRole('button',{name:'기록 저장'}));expect(save).not.toHaveBeenCalled();expect((screen.getByLabelText('수량') as HTMLInputElement).value).toBe('2');
});
it('locks after a stale save, preserves draft, and only refreshes after explicit confirmation',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);const stale=vi.fn(async()=>({ok:false,error:{code:'CONFLICT',message:'재고가 변경됐습니다.'}})),load=vi.fn(async()=>({ok:true,data:{document,recovered:false}}));vi.stubGlobal('electronWork',{inventory:{load,save:stale}});render(<InventoryWorkspace onClose={()=>{}}/>);await screen.findByRole('button',{name:'합성 탄력붕대 선택'});fireEvent.click(screen.getByRole('button',{name:'물품 수정'}));fireEvent.change(screen.getByLabelText('물품명'),{target:{value:'합성 미저장 수정'}});fireEvent.click(screen.getByRole('button',{name:'물품 저장'}));await screen.findByText(/재고가 변경됐습니다/);expect((screen.getByLabelText('물품명') as HTMLInputElement).value).toBe('합성 미저장 수정');expect((screen.getByRole('button',{name:'물품 저장'}) as HTMLButtonElement).disabled).toBe(true);expect(load).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole('button',{name:'원본 다시 읽기'}));await waitFor(()=>expect(screen.queryByLabelText('물품명')).toBeNull());expect(stale).toHaveBeenCalledTimes(1);
});
