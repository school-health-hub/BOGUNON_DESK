import type {PurchaseExportRequest} from '../protocol.js';
import type {PurchaseItem} from '../renderer/purchase/purchase/types.js';
import {purchaseOutputColumnIds,purchaseOutputColumnLabels} from './purchase-domain-types.js';
import {withPurchaseIssues,getPurchaseOutputReadiness,calculatePurchaseAmountCheck,selectedPurchaseTotal} from './purchase-domain.js';
export function validatePurchaseExport(value:unknown):PurchaseExportRequest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid export');
 const r=value as PurchaseExportRequest;
 if(Object.keys(r).sort().join(',')!=='columns,format,items'||!['csv','xlsx'].includes(r.format)||!Array.isArray(r.items)||r.items.length<1||r.items.length>500||!Array.isArray(r.columns)||r.columns.length<1||r.columns.length>9||new Set(r.columns).size!==r.columns.length||!r.columns.includes('name')||r.columns.some(c=>!purchaseOutputColumnIds.includes(c)))throw Error('Invalid export');
 const ids=new Set<string>();const items:PurchaseItem[]=r.items.map(i=>{
  if(!i||typeof i!=='object'||Object.keys(i).sort().join(',')!=='amountMismatchReviewed,budgetItem,id,importedAmount,issues,name,note,quantity,selected,sourceName,specification,unitPrice,vendor'||typeof i.id!=='string'||!i.id||i.id.length>200||ids.has(i.id)||i.selected!==true||typeof i.amountMismatchReviewed!=='boolean'||!Array.isArray(i.issues))throw Error('Invalid item');
  ids.add(i.id);
  for(const text of [i.name,i.specification,i.vendor,i.note,i.budgetItem]){
   if(typeof text!=='string'||text.length>65536||text.includes('\0'))throw Error('Invalid cell');
   // Original CSV writer quotes formula triggers in the first character. Reject ambiguous whitespace prefixes.
   if(r.format==='csv'&&/^\s+[=+\-@]/u.test(text)&&!['\t','\r'].includes(text[0]))throw Error('Ambiguous CSV formula');
  }
  if(i.sourceName!==null&&(typeof i.sourceName!=='string'||i.sourceName.length>4096))throw Error('Invalid source');
  for(const n of [i.quantity,i.unitPrice,i.importedAmount])if(n!==null&&(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER))throw Error('Invalid amount');
  const item=withPurchaseIssues(i),amount=calculatePurchaseAmountCheck(item);
  if(item.quantity===null||item.unitPrice===null||amount.computedAmount===null||!Number.isSafeInteger(amount.computedAmount))throw Error('Missing amount');
  return item;
 });
 if(!getPurchaseOutputReadiness(items).ready||!Number.isSafeInteger(selectedPurchaseTotal(items)))throw Error('Review amounts first');
 const safe={format:r.format,items,columns:[...r.columns]};if(Buffer.byteLength(JSON.stringify(safe))>8*1024*1024)throw Error('Oversized export');return JSON.parse(JSON.stringify(safe));
}
export function purchaseExportSummary(r:PurchaseExportRequest):string{
 return `${r.items.length}개 품목 · 합계 ${selectedPurchaseTotal(r.items).toLocaleString('ko-KR')}원\n출력 열: ${r.columns.map(c=>purchaseOutputColumnLabels[c]).join(' → ')}\n`+r.items.map((i,index)=>`${index+1}. ${i.name.slice(0,80)} · 수량 ${i.quantity} × 단가 ${i.unitPrice} = ${calculatePurchaseAmountCheck(i).computedAmount?.toLocaleString('ko-KR')}원`).join('\n');
}

export function decodePurchaseExport(value:unknown,request:PurchaseExportRequest):Buffer{
 if(!value||typeof value!=='object')throw Error('Invalid generated file');
 const r=value as Record<string,unknown>;
 if(Object.keys(r).sort().join(',')!=='bytesBase64,columns,format,itemCount,validated'||r.format!==request.format||r.itemCount!==request.items.length||r.validated!==true||JSON.stringify(r.columns)!==JSON.stringify(request.columns)||typeof r.bytesBase64!=='string'||r.bytesBase64.length>45*1024*1024||!r.bytesBase64.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(r.bytesBase64))throw Error('Invalid generated file');
 const bytes=Buffer.from(r.bytesBase64,'base64');if(bytes.length>32*1024*1024||bytes.toString('base64')!==r.bytesBase64)throw Error('Invalid generated size');
 if(request.format==='csv'?!bytes.subarray(0,3).equals(Buffer.from([239,187,191])):!bytes.subarray(0,4).equals(Buffer.from([80,75,3,4])))throw Error('Invalid generated format');return bytes;
}

export function purchaseExportFileName(format:'csv'|'xlsx',now=new Date()):string{return `품의_품목내역_${now.toISOString().slice(0,10).replaceAll('-','')}.${format}`;}
