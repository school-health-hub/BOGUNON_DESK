import type {PurchaseItem,PurchaseSettlement,PurchaseSettlementExportRow,PurchaseSettlementSummary} from '../renderer/purchase/purchase/types.js';
import {validatePurchaseExport,decodePurchaseExport,purchaseExportSummary} from './purchase-export-validation.js';
import {calculatePurchaseSettlementSummary,calculatePurchaseSettlementDisplaySummary,createPurchaseSettlementExportRows} from './purchase-settlement-domain.js';
import type {PurchaseTable} from '../protocol.js';
export const EDUFINE_HEADERS=['내용','규격','수량','예상단가'] as const;
export const SETTLEMENT_HEADERS=['번호','품명','품의수량','실제수량','품의단가','실제단가','품의금액','실제금액','차액','상태','비고'] as const;
export type SpecialOutput={kind:'settlement'|'edufine';format:'xlsx';items:readonly PurchaseItem[];headers:readonly string[];settlement?:PurchaseSettlement;rows?:readonly PurchaseSettlementExportRow[];summary?:PurchaseSettlementSummary};
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=Number.MAX_SAFE_INTEGER;
export function validateSpecialOutput(value:unknown,kind:'settlement'|'edufine',output=true):SpecialOutput{
 if(!plain(value)||Object.keys(value).sort().join(',')!==(kind==='edufine'?'items':'items,settlement'))throw Error('Invalid request');
 const base=validatePurchaseExport({format:'xlsx',columns:['name','quantity','unitPrice','amount'],items:value.items});
 if(kind==='edufine')return {...base,format:'xlsx',kind,headers:EDUFINE_HEADERS};
 const s=value.settlement;if(!plain(s)||!Object.keys(s).every(k=>['items','shippingFee','discountAmount','adjustmentNote','tax'].includes(k))||!Array.isArray(s.items)||s.items.length!==base.items.length||!finite(s.shippingFee)||Number(s.shippingFee)<0||!finite(s.discountAmount)||Number(s.discountAmount)<0||typeof s.adjustmentNote!=='string'||s.adjustmentNote.length>65536)throw Error('Invalid settlement');
 const ids=new Set(base.items.map(i=>i.id)),seen=new Set<string>();
 for(const row of s.items){
  if(!plain(row)||Object.keys(row).sort().join(',')!=='actualQuantity,actualUnitPrice,note,purchaseItemId,status'||typeof row.purchaseItemId!=='string'||!ids.has(row.purchaseItemId)||seen.has(row.purchaseItemId)||typeof row.status!=='string'||!['pending','purchased','partial','cancelled'].includes(row.status)||typeof row.note!=='string'||row.note.length>65536||row.note.includes('\0'))throw Error('Invalid actual row');seen.add(row.purchaseItemId);
  for(const n of [row.actualQuantity,row.actualUnitPrice])if(n!==null&&(!finite(n)||Number(n)<0))throw Error('Invalid actual number');
  if(['purchased','partial'].includes(row.status)&&(row.actualQuantity===null||Number(row.actualQuantity)<=0||row.actualUnitPrice===null))throw Error('Missing actual amount');
 }
 if(s.tax!==undefined){if(!plain(s.tax)||Object.keys(s.tax).sort().join(',')!=='amount,mode'||!['unspecified','included','excluded','exempt'].includes(String(s.tax.mode))||(s.tax.amount!==null&&(!finite(s.tax.amount)||Number(s.tax.amount)<0)))throw Error('Invalid tax');}
 const settlement=JSON.parse(JSON.stringify(s)) as PurchaseSettlement;
 const summary=calculatePurchaseSettlementSummary(base.items,settlement),display=calculatePurchaseSettlementDisplaySummary(base.items,settlement),rows=createPurchaseSettlementExportRows(base.items,settlement);
 if(Object.values(summary).some(n=>!finite(n))||summary.finalActual<0||rows.some(r=>[r.plannedAmount,r.actualAmount,r.difference].some(n=>n!==null&&(!finite(n)||!Number.isSafeInteger(n)))))throw Error('Invalid settlement total');
 if(output&&(!display.legacyOutputSafe||(settlement.tax?.mode==='excluded'&&settlement.tax.amount===null)))throw Error('Separate tax is not included in legacy XLSX');
 const result:SpecialOutput={kind,format:'xlsx',headers:SETTLEMENT_HEADERS,items:base.items,settlement,rows,summary};if(Buffer.byteLength(JSON.stringify(result))>8*1024*1024)throw Error('Oversized settlement');return result;
}
export function specialSummary(r:SpecialOutput):string{
 if(r.kind==='edufine')return '에듀파인 고정 4열: 내용 · 규격 · 수량 · 예상단가\n'+purchaseExportSummary({format:'xlsx',items:r.items,columns:['name','specification','quantity','unitPrice']});
 const summary=r.summary!;return `구매결과 ${r.items.length}개 · 품의합계 ${summary.plannedTotal.toLocaleString('ko-KR')}원 · 실제상품 ${summary.actualSubtotal.toLocaleString('ko-KR')}원\n배송비 ${summary.shippingFee}원 · 할인 ${summary.discountAmount}원\n최종결제금액 ${summary.finalActual.toLocaleString('ko-KR')}원 · 차액 ${summary.difference.toLocaleString('ko-KR')}원\n`+r.rows!.map(row=>`${row.number}. ${row.name.slice(0,80)} · ${row.status} · 실제수량 ${row.actualQuantity??'-'} × 실제단가 ${row.actualUnitPrice??'-'} = ${row.actualAmount??'-'}원`).join('\n');
}
export function decodeSpecialFile(value:unknown,r:SpecialOutput):Buffer{return decodePurchaseExport(value,{format:'xlsx',items:r.items,columns:r.headers});}
export function decodeSpecialPreview(value:unknown,r:SpecialOutput):PurchaseTable{
 if(!plain(value)||JSON.stringify(value.headers)!==JSON.stringify(r.headers)||!Array.isArray(value.rows)||value.rows.length!==r.items.length)throw Error('Invalid preview');
 for(const row of value.rows)if(!Array.isArray(row)||row.length!==r.headers.length||row.some(v=>v!==null&&typeof v!=='string'&&!finite(v)))throw Error('Invalid preview cell');
 if(r.kind==='settlement'&&(!Array.isArray(value.summaryRows)||value.summaryRows.length!==6||value.summaryRows.some(row=>!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||!finite(row[1]))))throw Error('Invalid preview summary');
 return value as unknown as PurchaseTable;
}
export function specialRequest(r:SpecialOutput,preview:boolean){return r.kind==='edufine'?{operation:'edufine',items:r.items,preview}:{operation:'settlement',rows:r.rows,summary:r.summary,preview};}
export function specialFileName(kind:'settlement'|'edufine'){return `${kind==='edufine'?'에듀파인_품목내역':'품의_구매결과'}_${new Date().toISOString().slice(0,10).replaceAll('-','')}.xlsx`;}
