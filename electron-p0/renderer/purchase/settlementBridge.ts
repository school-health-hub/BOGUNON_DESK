import type {PurchaseItem,PurchaseSettlement} from './purchase/types';
export function settlementPayload(items:readonly PurchaseItem[],settlement:PurchaseSettlement){const selected=items.filter(i=>i.selected),ids=new Set(selected.map(i=>i.id));return {items:selected,settlement:{...settlement,items:settlement.items.filter(i=>ids.has(i.purchaseItemId))}};}
