import {IMAGE_IMPORT_LIMITS,type ImageSelection,type ImageAnalysis,type OcrLine} from '../../purchase-image-protocol';
import type {PurchaseItem} from './purchase/types';
import {withPurchaseIssues,calculatePurchaseAmountCheck} from './purchase/purchaseDomain';
export type ImageReviewRow={id:string;sourceId:string;name:string;option:string;specification:string;quantity:string;unitPrice:string;amount:string;originalPrice:string;discount:string;lineIndices:number[];warnings:string[];approved:boolean};
export type ImageCharge={sourceId:string;text:string;lineIndex:number;kind:'shipping'|'total'|'discount'};
const normal=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
const money=(s:string)=>{const match=s.match(/(?:^|\s|:)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:원|KRW|₩|$)/i);return match?match[1].replace(/,/g,''):'';};
export function parseImageReview(selection:ImageSelection,analysis:ImageAnalysis):{rows:ImageReviewRow[];charges:ImageCharge[]}{
 const rows:ImageReviewRow[]=[],charges:ImageCharge[]=[];
 for(const source of selection.sources){const result=analysis.results.find(r=>r.sourceId===source.id);if(result?.status!=='success')continue;let row:ImageReviewRow|undefined;
  const add=(name='',index=-1)=>{if(rows.length>=IMAGE_IMPORT_LIMITS.reviewRows)throw new RangeError('검토 품목이 200개를 초과했습니다. 이미지를 나누어 분석해 주세요.');row={id:`${source.id}-${rows.length}`,sourceId:source.id,name,option:'',specification:'',quantity:'',unitPrice:'',amount:'',originalPrice:'',discount:'',lineIndices:index<0?[]:[index],warnings:[],approved:false};rows.push(row);return row;};
  result.lines.forEach((line:OcrLine,index)=>{const text=normal(line.text);if(!text)return;
   const charge=/배송비|배송료/.test(text)?'shipping':/주문\s*(총액|합계|할인)|예상\s*합계|총\s*(결제|상품금액|합계)|결제\s*예정|^(합계|주문총액)\s*[:：]?/.test(text)?(/할인/.test(text)?'discount':'total'):null;
   if(charge){charges.push({sourceId:source.id,text,lineIndex:index,kind:charge});return;}
   const named=text.match(/^(?:상품명|품명|제품명)\s*[:：]\s*(.*)$/);
   if(named){add(named[1],index);if(line.confidence<85)row!.warnings.push('상품명 인식 신뢰도가 낮습니다.');return;}
   if(/장바구니|검토 자료|전체 선택|선택 삭제|주문하기/.test(text))return;
   const field=text.match(/^(옵션|규격|수량|단가|적용\s*단가|판매가|할인가|상품\s*금액|금액|정가|정상가|할인\s*전\s*가격|상품\s*할인)\s*[:：]?\s*(.*)$/);
   if(field){if(!row)add();row!.lineIndices.push(index);const [,label,value]=field;
    if(label==='옵션')row!.option=value;else if(label==='규격')row!.specification=value;else if(label==='수량'){const q=value.match(/^(\d+(?:\.\d+)?)\s*(?:개|세트|상자|팩)?$/);if(q)row!.quantity=q[1];else row!.warnings.push('수량과 묶음 구성을 직접 구분해 주세요.');}
    else {const amount=money(value);if(/정가|정상가|할인\s*전/.test(label))row!.originalPrice=amount;else if(/상품\s*할인/.test(label))row!.discount=amount;else if(/금액/.test(label))row!.amount=amount;else row!.unitPrice=amount;if(!amount)row!.warnings.push('가격 인식 결과를 직접 확인해 주세요.');}
    if(line.confidence<85)row!.warnings.push('낮은 신뢰도의 필드가 있습니다.');return;
   }
   // Unlabelled shopping layouts remain proposals; never infer quantity from pack sizes/prices.
   if(/[가-힣A-Za-z]{2}/.test(text)&&!/[₩]|\d[\d,]*\s*원/.test(text)){
    if(!row||row.quantity||row.unitPrice||row.amount)add(text,index);else {row.lineIndices.push(index);row.name=normal(row.name+' '+text);}row!.warnings.push('상품명과 옵션의 구분을 원본에서 확인해 주세요.');
   }else if(row){row.lineIndices.push(index);row.warnings.push('구조화하지 못한 숫자·문구가 있습니다. 원문을 확인해 주세요.');}
  });
 }
 return {rows,charges};
}
export function emptyImageReviewRow(sourceId:string,id:string):ImageReviewRow{return {id,sourceId,name:'',option:'',specification:'',quantity:'',unitPrice:'',amount:'',originalPrice:'',discount:'',lineIndices:[],warnings:['사용자가 이미지 근거를 확인해 직접 입력한 품목입니다.'],approved:false};}
const number=(s:string)=>{const value=s.trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value))return null;const n=Number(value.replace(/,/g,''));return Number.isSafeInteger(n)?n:null;};
export function reviewRowItem(row:ImageReviewRow,selection:ImageSelection):PurchaseItem|null{
 const source=selection.sources.find(s=>s.id===row.sourceId);if(!source||!row.name.trim()||row.name.length>300||row.option.length>300||row.specification.length>300)return null;
 const quantity=number(row.quantity),unitPrice=number(row.unitPrice),amount=row.amount.trim()===''?null:number(row.amount);
 if(quantity===null||quantity<=0||quantity>100000||unitPrice===null||unitPrice>1_000_000_000||(row.amount.trim()!==''&&amount===null)||(amount!==null&&amount>1_000_000_000_000))return null;
 return withPurchaseIssues({id:row.id,selected:true,name:row.name.trim(),specification:[row.option.trim(),row.specification.trim()].filter(Boolean).join(' · '),quantity,unitPrice,importedAmount:amount,vendor:'',note:`이미지 ${source.order} 검토 · SHA ${source.sha256.slice(0,12)} · ${row.lineIndices.map(i=>i+1).join(',')||'직접 입력'}행 근거${row.originalPrice?' · 할인 전 '+row.originalPrice+'원 (미적용)':''}${row.discount?' · 상품 할인 '+row.discount+'원 (자동 차감 아님)':''}`,budgetItem:'',sourceName:source.name,amountMismatchReviewed:false});
}
const key=(name:string,spec:string)=>normal(name).toLocaleLowerCase()+'\0'+normal(spec).toLocaleLowerCase();
export function duplicateReviewIds(rows:readonly ImageReviewRow[],existing:readonly PurchaseItem[]):Set<string>{
 const keys=rows.map(r=>key(r.name,[r.option.trim(),r.specification.trim()].filter(Boolean).join(' · '))),old=new Set(existing.map(i=>key(i.name,i.specification)));
 return new Set(rows.filter((r,i)=>r.name.trim()&&(old.has(keys[i])||keys.some((k,j)=>i!==j&&k===keys[i]))).map(r=>r.id));
}
export function reviewWarnings(row:ImageReviewRow,selection:ImageSelection):string[]{
 const item=reviewRowItem(row,selection),warnings=[...row.warnings];
 if(!item)warnings.push('품명·수량·적용 단가를 확인해 주세요. 빈값은 임의로 채우지 않습니다.');
 if(item&&calculatePurchaseAmountCheck(item).status==='mismatch-unreviewed')warnings.push('수량 × 단가와 이미지 상품금액이 다릅니다. 기존 금액 검토에서도 확인이 필요합니다.');
 if(row.originalPrice)warnings.push(`할인 전 가격 ${row.originalPrice}원은 적용 단가로 사용하지 않습니다.`);
 if(row.discount)warnings.push(`상품 할인 ${row.discount}원은 자동 차감하지 않습니다. 적용 단가를 확인해 주세요.`);
 return [...new Set(warnings)];
}
