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

import {createEmptyInventory,upsertInventoryItem,removeInventoryItem} from '../../src/inventory-management/model';
it('creates empty local inventory, edits item metadata and prevents history/unit loss',()=>{
 const empty=createEmptyInventory('2026-11-02T00:00:00Z'),item={itemId:'synthetic-new',name:' 합성 거즈 ',baseUnit:'개',recommendedStock:5};
 const added=upsertInventoryItem(empty,item,empty.updatedAt);expect(added.items[0].name).toBe('합성 거즈');expect(empty.items).toEqual([]);
 expect(removeInventoryItem(added,item.itemId,empty.updatedAt).items).toEqual([]);
 const stocked=applyInventoryMovement(added,{kind:'receive',itemId:item.itemId,quantity:3,reason:'합성 입고',expirationDate:'2027-01-01'},'2026-11-02T00:00:00Z');
 const edited=upsertInventoryItem(stocked,{...stocked.items[0],name:'합성 거즈 수정',recommendedStock:8},empty.updatedAt);expect(edited.lots).toEqual(stocked.lots);expect(edited.movements).toEqual(stocked.movements);
 expect(()=>upsertInventoryItem(stocked,{...item,baseUnit:'상자'},empty.updatedAt)).toThrow('단위');expect(()=>removeInventoryItem(stocked,item.itemId,empty.updatedAt)).toThrow('이력');
 for(const bad of [-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1])expect(()=>upsertInventoryItem(empty,{...item,recommendedStock:bad},empty.updatedAt)).toThrow();
});
it('disposes expired/quarantined lots but never uses them, preserving original and history',()=>{
 const doc=createSyntheticInventory('2026-11-02'),input={itemId:'synthetic-bandage',lotId:'lot-bandage-expired',quantity:2,reason:'합성 유효기간 경과'};
 expect(()=>applyInventoryMovement(doc,{...input,kind:'use'},'2026-11-02T00:00:00Z')).toThrow('부족');
 const disposed=applyInventoryMovement(doc,{...input,kind:'dispose'},'2026-11-02T00:00:00Z');expect(disposed.lots.find(l=>l.lotId===input.lotId)?.balance).toBe(0);expect(doc.lots.find(l=>l.lotId===input.lotId)?.balance).toBe(2);expect(disposed.movements[0].expirationDate).toBe('2026-10-01');
 const isolated={...doc,lots:doc.lots.map(l=>({...l,status:'quarantined' as const}))};expect(()=>applyInventoryMovement(isolated,{...input,kind:'use',lotId:undefined,quantity:1},'2026-11-02T00:00:00Z')).toThrow();expect(applyInventoryMovement(isolated,{...input,kind:'dispose'},'2026-11-02T00:00:00Z').movements).toHaveLength(1);
});
it('deducts FEFO and rejects invalid quantity, date, overflow and foreign lot',()=>{
 const doc=createSyntheticInventory('2026-11-02');
 const received=applyInventoryMovement(doc,{kind:'receive',itemId:'synthetic-gloves',quantity:2,expirationDate:'2026-12-01',reason:'합성'},'2026-11-02T00:00:00Z');
 const used=applyInventoryMovement(received,{kind:'use',itemId:'synthetic-gloves',quantity:9,reason:'합성'},'2026-11-02T00:00:00Z');expect(used.lots.find(l=>l.lotId==='lot-gloves')?.balance).toBe(0);expect(used.lots.at(-1)?.balance).toBe(1);
 for(const quantity of [-1,0,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])expect(()=>applyInventoryMovement(doc,{kind:'receive',itemId:'synthetic-gloves',quantity,expirationDate:'2027-01-01',reason:'합성'},'2026-11-02T00:00:00Z')).toThrow();
 for(const expirationDate of ['', '2026-02-30','2026-10-01'])expect(()=>applyInventoryMovement(doc,{kind:'receive',itemId:'synthetic-gloves',quantity:1,expirationDate,reason:'합성'},'2026-11-02T00:00:00Z')).toThrow();
 expect(()=>applyInventoryMovement(doc,{kind:'use',itemId:'synthetic-gloves',lotId:'lot-sanitizer',quantity:1,reason:'합성'},'2026-11-02T00:00:00Z')).toThrow();
 const legacy={...doc,movements:[{movementId:'movement-2',kind:'receive' as const,itemId:'synthetic-gloves',quantity:1,reason:'합성',createdAt:'2026-11-02T00:00:00Z'}]};expect(applyInventoryMovement(legacy,{kind:'use',itemId:'synthetic-gloves',quantity:1,reason:'합성'},'2026-11-02T00:00:00Z').movements[1].movementId).toBe('movement-3');
});
