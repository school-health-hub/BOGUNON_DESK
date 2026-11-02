// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {InventoryWorkspace} from '../../src/inventory-management/InventoryWorkspace';
import {createSyntheticInventory} from '../../src/inventory-management/model';

const document=createSyntheticInventory('2026-11-02');
const save=vi.fn(async(next:typeof document)=>({ok:true as const,data:{document:next,recovered:false}}));
afterEach(()=>{cleanup();save.mockClear();});
describe('Inventory workspace',()=>{
 it('searches stock and persists a synthetic receive movement',async()=>{
  vi.stubGlobal('electronWork',{inventory:{load:async()=>({ok:true,data:{document,recovered:false}}),save}});
  render(<InventoryWorkspace onClose={()=>{}}/>);await screen.findByRole('heading',{name:'재고 관리'});
  fireEvent.change(screen.getByLabelText('물품 검색'),{target:{value:'장갑'}});expect(screen.getByText('합성 니트릴 장갑')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'합성 니트릴 장갑 선택'}));fireEvent.click(screen.getByRole('button',{name:'입고 기록'}));
  fireEvent.change(screen.getByLabelText('수량'),{target:{value:'5'}});fireEvent.change(screen.getByLabelText('사유'),{target:{value:'합성 입고 확인'}});fireEvent.click(screen.getByRole('button',{name:'기록 저장'}));
  await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));expect(save.mock.calls[0]?.[0].movements.at(-1)?.kind).toBe('receive');
 });
});
