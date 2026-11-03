import type {InventoryPurchaseLine} from '../../../src/inventory-management/model';
import {createEmptyPurchaseItem,updatePurchaseItem} from './purchase/purchaseDomain';
export type InventoryPurchaseRequest=Readonly<{id:string;lines:readonly InventoryPurchaseLine[]}>;
// Session-only handoff: no storage, network, inventory adjustment or price invention.
export function inventoryPurchaseItems(lines:readonly InventoryPurchaseLine[],nextId:()=>string){
 if(!lines.length||lines.length>500||new Set(lines.map(l=>l.inventoryItemId)).size!==lines.length||lines.some(l=>!l.inventoryItemId||!l.name.trim()||l.name.length>200||l.specification.length>200||!Number.isSafeInteger(l.quantity)||l.quantity<=0))throw Error('Invalid inventory purchase selection');
 return lines.map(line=>updatePurchaseItem(createEmptyPurchaseItem(nextId()),{name:line.name,specification:line.specification,quantity:line.quantity}));
}
