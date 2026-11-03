// @vitest-environment jsdom
import {StrictMode} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {PurchaseSession} from '../renderer/purchase/PurchaseSession';
import {inventoryPurchaseItems} from '../renderer/purchase/inventoryPurchase';
const lines=[{inventoryItemId:'synthetic-id',name:'합성 구매 거즈',specification:'합성 5cm',quantity:3}];
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses existing Purchase validation without price invention and rejects invalid payload',()=>{
 const [item]=inventoryPurchaseItems(lines,()=> 'synthetic-session');expect(item).toMatchObject({name:lines[0].name,specification:lines[0].specification,quantity:3,unitPrice:null,importedAmount:null,selected:true});expect(item.issues).toContain('invalidUnitPrice');
 for(const quantity of [0,-1,NaN,1.5,Number.MAX_SAFE_INTEGER+1])expect(()=>inventoryPurchaseItems([{...lines[0],quantity}],()=> 'id')).toThrow();expect(()=>inventoryPurchaseItems([...lines,...lines],()=> 'id')).toThrow();
});
it('appends once to existing Purchase session, preserving original inputs across close/reopen',async()=>{
 const save=vi.fn(()=>{throw Error('Inventory must not save');});vi.stubGlobal('electronWork',{inventory:{save},purchase:{cancelCsv:async()=>({ok:true,data:null})}});const applied=vi.fn(),close=vi.fn(),view=render(<StrictMode><PurchaseSession open onClose={close}/></StrictMode>);
 fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));const input=screen.getByLabelText('1행 품명');fireEvent.focus(input);fireEvent.change(input,{target:{value:'기존 합성 물품'}});fireEvent.keyDown(input,{key:'Enter'});fireEvent.blur(input);
 const incoming={id:'synthetic-request',lines};view.rerender(<StrictMode><PurchaseSession open onClose={close} incoming={incoming} onIncomingApplied={applied}/></StrictMode>);await waitFor(()=>expect(screen.getByLabelText('2행 품명')).toBeTruthy());expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('기존 합성 물품');expect((screen.getByLabelText('2행 규격') as HTMLInputElement).value).toBe('합성 5cm');expect((screen.getByLabelText('2행 수량') as HTMLInputElement).value).toBe('3');expect((screen.getByLabelText('2행 단가') as HTMLInputElement).value).toBe('');
 view.rerender(<StrictMode><PurchaseSession open={false} onClose={close} incoming={incoming} onIncomingApplied={applied}/></StrictMode>);view.rerender(<StrictMode><PurchaseSession open onClose={close} incoming={incoming} onIncomingApplied={applied}/></StrictMode>);expect(screen.queryByLabelText('3행 품명')).toBeNull();expect(applied).toHaveBeenCalledTimes(1);expect(save).not.toHaveBeenCalled();
});
