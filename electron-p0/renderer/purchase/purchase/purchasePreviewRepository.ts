import type {PurchaseItem,PurchaseOutputColumnId,PurchaseSettlement} from './types';import {settlementPayload} from '../settlementBridge';
export const purchasePreviewRepository={
 general:async(format:'csv'|'xlsx'|'edufine',items:readonly PurchaseItem[],_columns:readonly PurchaseOutputColumnId[])=>{if(format!=='edufine')throw Error('이 형식은 기존 CSV/XLSX 저장 검토를 사용합니다.');const r=await window.electronWork.purchase.previewEdufine({items:items.filter(i=>i.selected)});if(!r.ok)throw Error(r.error.message);return r.data;},
 settlement:async(items:readonly PurchaseItem[],settlement:PurchaseSettlement)=>{const r=await window.electronWork.purchase.previewSettlement(settlementPayload(items,settlement));if(!r.ok)throw Error(r.error.message);return {preview:r.data,summary:{headers:['정산 항목','기존 출력 금액'],rows:r.data.summaryRows??[]}};},
};
