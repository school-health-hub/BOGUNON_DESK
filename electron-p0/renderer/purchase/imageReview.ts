import type {ImageSelection,ImageBox} from '../../purchase-image-protocol';
import type {PurchaseItem} from './purchase/types';
import {duplicateCandidates} from './imageSimilarity';
import {withPurchaseIssues,calculatePurchaseAmountCheck} from './purchase/purchaseDomain';
export type ReviewField='name'|'option'|'specification'|'quantity'|'unitPrice'|'amount';
export type EvidenceField=ReviewField|'originalPrice'|'discount';
export type ImageReviewRow={id:string;sourceId:string;name:string;option:string;specification:string;quantity:string;unitPrice:string;amount:string;originalPrice:string;discount:string;lineIndices:number[];warnings:string[];approved:boolean;fieldEvidence?:Partial<Record<EvidenceField,number[]>>;fieldBoxes?:Partial<Record<EvidenceField,ImageBox[]>>;confidences?:Partial<Record<EvidenceField,number>>;priceCandidates?:{label:string;value:string;lineIndex:number}[]};
export type ImageCharge={sourceId:string;text:string;lineIndex:number;kind:'shipping'|'total'|'discount'};
export {parseCartLayout as parseImageReview} from './cartLayout';
export function emptyImageReviewRow(sourceId:string,id:string):ImageReviewRow{return {id,sourceId,name:'',option:'',specification:'',quantity:'',unitPrice:'',amount:'',originalPrice:'',discount:'',lineIndices:[],warnings:['사용자가 이미지 근거를 확인해 직접 입력한 품목입니다.'],approved:false};}
const number=(s:string)=>{const value=s.trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value))return null;const n=Number(value.replace(/,/g,''));return Number.isSafeInteger(n)?n:null;};
export function reviewRowItem(row:ImageReviewRow,selection:ImageSelection):PurchaseItem|null{
 const source=selection.sources.find(s=>s.id===row.sourceId);if(!source||!row.name.trim()||row.name.length>300||row.option.length>300||row.specification.length>300)return null;
 const quantity=number(row.quantity),unitPrice=number(row.unitPrice),amount=row.amount.trim()===''?null:number(row.amount);
 if(quantity===null||quantity<=0||quantity>100000||unitPrice===null||unitPrice>1_000_000_000||(row.amount.trim()!==''&&amount===null)||(amount!==null&&amount>1_000_000_000_000))return null;
 return withPurchaseIssues({id:row.id,selected:true,name:row.name.trim(),specification:[row.option.trim(),row.specification.trim()].filter(Boolean).join(' · '),quantity,unitPrice,importedAmount:amount,vendor:'',note:`이미지 ${source.order} 검토 · SHA ${source.sha256.slice(0,12)} · ${row.lineIndices.map(i=>i+1).join(',')||'직접 입력'}행 근거${row.originalPrice?' · 할인 전 '+row.originalPrice+'원 (미적용)':''}${row.discount?' · 상품 할인 '+row.discount+'원 (자동 차감 아님)':''}`,budgetItem:'',sourceName:source.name,amountMismatchReviewed:false});
}
export function duplicateReviewIds(rows:readonly ImageReviewRow[],existing:readonly PurchaseItem[]):Set<string>{return new Set(duplicateCandidates(rows,existing).map(c=>c.rowId));}
export function reviewWarnings(row:ImageReviewRow,selection:ImageSelection):string[]{
 const item=reviewRowItem(row,selection),warnings=[...row.warnings];
 if(!item)warnings.push('품명·수량·적용 단가를 확인해 주세요. 빈값은 임의로 채우지 않습니다.');
 if(item&&calculatePurchaseAmountCheck(item).status==='mismatch-unreviewed')warnings.push('수량 × 단가와 이미지 상품금액이 다릅니다. 기존 금액 검토에서도 확인이 필요합니다.');
 if(row.originalPrice)warnings.push(`할인 전 가격 ${row.originalPrice}원은 적용 단가로 사용하지 않습니다.`);
 if(row.discount)warnings.push(`상품 할인 ${row.discount}원은 자동 차감하지 않습니다. 적용 단가를 확인해 주세요.`);
 return [...new Set(warnings)];
}
