import type {ImageAiAnalysis} from '../../purchase-ai-protocol';
import type {ImageReviewRow,ImageCharge} from './imageReview';
export function aiImageReview(analysis:ImageAiAnalysis):{rows:ImageReviewRow[];charges:ImageCharge[]}{
 const rows:ImageReviewRow[]=[],charges:ImageCharge[]=[];const value=(n:number|null)=>n===null?'':String(n);
 for(const result of analysis.results){for(const [index,item] of result.items.entries())rows.push({id:`${analysis.requestId}-${item.sourceId}-${index}`,sourceId:item.sourceId,name:item.name,option:item.option??'',specification:item.specification??'',quantity:value(item.quantity),unitPrice:value(item.unitPrice),amount:value(item.amount),originalPrice:value(item.originalPrice),discount:value(item.discount),lineIndices:[],warnings:[...result.warnings,...item.uncertain.map(k=>`${k}: 불명확 · 원본 확인 필요`),...(['quantity','unitPrice','amount'] as const).filter(k=>item[k]===null).map(k=>`${k}: 원본에서 미확정 · 임의 추정하지 않았습니다.`),'AI 제시 근거 문구는 원본과 직접 대조하세요. 좌표·정확도는 검증되지 않았습니다.'],approved:false,aiEvidence:item.evidence,bundleQuantity:item.bundleQuantity,bundleQuantityText:value(item.bundleQuantity),edited:false});
  for(const [kind,key] of [['shipping','shipping'],['discount','discount'],['total','total']] as const)if(result.order[key]!==null)charges.push({sourceId:result.sourceId,kind,lineIndex:charges.length,text:`AI ${kind==='shipping'?'배송비':kind==='discount'?'주문 할인':'주문 총액'} ${result.order[key]}원 · ${result.order.evidence} · 자동 반영 없음`,ai:true});
 }
 return {rows,charges};
}
