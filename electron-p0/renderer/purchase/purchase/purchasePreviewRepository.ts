import type {PurchaseItem,PurchaseOutputColumnId,PurchaseSettlement} from './types';import {settlementPayload} from '../settlementBridge';
import {createPurchaseClipboard} from './purchaseClipboard';
import {validatePurchaseExport} from '../../../main/purchase-export-request.js';
export const purchasePreviewRepository={
 general:async(format:'csv'|'xlsx'|'edufine',items:readonly PurchaseItem[],columns:readonly PurchaseOutputColumnId[])=>{
  if(format==='edufine'){
   const result=await window.electronWork.purchase.previewEdufine({items:items.filter(item=>item.selected)});
   if(!result.ok)throw Error(result.error.message);
   return result.data;
  }
  let request;
  try {
   request=validatePurchaseExport({format,items:items.filter(item=>item.selected),columns});
  } catch {
   throw Error('선택 품목·수량·단가·금액·출력 열을 확인해 주세요.');
  }
  const {headers,rows}=createPurchaseClipboard(request.items,request.columns);
  if(format==='xlsx')return {headers,rows};
  const textColumns:ReadonlySet<PurchaseOutputColumnId>=new Set(['name','specification','vendor','note','budgetItem']);
  return {headers,rows:rows.map(row=>row.map((cell,index)=>textColumns.has(columns[index])&&/^[=+\-@\t\r]/.test(cell)?"'"+cell:cell))};
 },
 settlement:async(items:readonly PurchaseItem[],settlement:PurchaseSettlement)=>{const r=await window.electronWork.purchase.previewSettlement(settlementPayload(items,settlement));if(!r.ok)throw Error(r.error.message);return {preview:r.data,summary:{headers:['정산 항목','기존 출력 금액'],rows:r.data.summaryRows??[]}};},
};
