import type {PurchaseExportRequest} from '../protocol.js';
import type {PurchaseItem} from '../renderer/purchase/purchase/types.js';
import {purchaseOutputColumnIds} from './purchase-domain-types.js';
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
 const safe={format:r.format,items,columns:[...r.columns]};if(new TextEncoder().encode(JSON.stringify(safe)).byteLength>8*1024*1024)throw Error('Oversized export');return JSON.parse(JSON.stringify(safe));
}
