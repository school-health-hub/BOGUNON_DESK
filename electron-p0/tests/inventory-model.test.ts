import {describe,expect,it} from 'vitest';
import {applyInventoryMovement,createSyntheticInventory,filterInventory,inventorySummary,purchaseCandidate} from '../../src/inventory-management/model';

describe('Inventory local domain',()=>{
 it('derives stock, shortage and expiration from item lots',()=>{
  const inventory=createSyntheticInventory('2026-11-02');
  expect(inventorySummary(inventory,'2026-11-02')).toEqual({items:3,shortage:2,expiring:1,expired:1});
  expect(filterInventory(inventory,{query:'장갑',state:'shortage'},'2026-11-02').map(row=>row.name)).toEqual(['합성 니트릴 장갑']);
 });
 it('records receive, use and dispose movements without mutating the input',()=>{
  const original=createSyntheticInventory('2026-11-02');
  const received=applyInventoryMovement(original,{kind:'receive',itemId:'synthetic-gloves',quantity:5,reason:'합성 입고',expirationDate:'2026-12-15'},'2026-11-02T09:00:00.000Z');
  const used=applyInventoryMovement(received,{kind:'use',itemId:'synthetic-gloves',quantity:3,reason:'합성 사용'},'2026-11-02T10:00:00.000Z');
  const disposed=applyInventoryMovement(used,{kind:'dispose',itemId:'synthetic-gloves',quantity:2,reason:'합성 폐기'},'2026-11-02T11:00:00.000Z');
  expect(original.movements).toHaveLength(0);expect(disposed.movements.map(row=>row.kind)).toEqual(['receive','use','dispose']);
  expect(filterInventory(disposed,{query:'장갑',state:'all'},'2026-11-02')[0]?.availableStock).toBe(8);
 });
 it('rejects invalid stock changes and exposes a read-only Purchase candidate',()=>{
  const inventory=createSyntheticInventory('2026-11-02');
  expect(()=>applyInventoryMovement(inventory,{kind:'use',itemId:'synthetic-gloves',quantity:99,reason:'합성 사용'},'2026-11-02T10:00:00.000Z')).toThrow('재고');
  expect(purchaseCandidate(filterInventory(inventory,{query:'붕대',state:'all'},'2026-11-02')[0]!)).toEqual({inventoryItemId:'synthetic-bandage',name:'합성 탄력붕대',baseUnit:'개',requestedBaseQuantity:12,stockEffect:'NONE'});
 });
});
