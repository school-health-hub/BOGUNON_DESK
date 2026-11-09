import type {PurchaseExportRequest} from '../protocol.js';
import {purchaseOutputColumnLabels} from './purchase-domain-types.js';
import {calculatePurchaseAmountCheck,selectedPurchaseTotal} from './purchase-domain.js';
export {validatePurchaseExport} from './purchase-export-request.js';
export function purchaseExportSummary(r:PurchaseExportRequest):string{
 return `${r.items.length}개 품목 · 합계 ${selectedPurchaseTotal(r.items).toLocaleString('ko-KR')}원\n출력 열: ${r.columns.map(c=>purchaseOutputColumnLabels[c]).join(' → ')}\n`+r.items.map((i,index)=>`${index+1}. ${i.name.slice(0,80)} · 수량 ${i.quantity} × 단가 ${i.unitPrice} = ${calculatePurchaseAmountCheck(i).computedAmount?.toLocaleString('ko-KR')}원`).join('\n');
}

export function decodePurchaseExport(value:unknown,request:{format:"csv"|"xlsx";items:readonly unknown[];columns:readonly string[]}):Buffer{
 if(!value||typeof value!=='object')throw Error('Invalid generated file');
 const r=value as Record<string,unknown>;
 if(Object.keys(r).sort().join(',')!=='bytesBase64,columns,format,itemCount,validated'||r.format!==request.format||r.itemCount!==request.items.length||r.validated!==true||JSON.stringify(r.columns)!==JSON.stringify(request.columns)||typeof r.bytesBase64!=='string'||r.bytesBase64.length>45*1024*1024||!r.bytesBase64.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(r.bytesBase64))throw Error('Invalid generated file');
 const bytes=Buffer.from(r.bytesBase64,'base64');if(bytes.length>32*1024*1024||bytes.toString('base64')!==r.bytesBase64)throw Error('Invalid generated size');
 if(request.format==='csv'?!bytes.subarray(0,3).equals(Buffer.from([239,187,191])):!bytes.subarray(0,4).equals(Buffer.from([80,75,3,4])))throw Error('Invalid generated format');return bytes;
}

export function purchaseExportFileName(format:'csv'|'xlsx',now=new Date()):string{return `품의_품목내역_${now.toISOString().slice(0,10).replaceAll('-','')}.${format}`;}
