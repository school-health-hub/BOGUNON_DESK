import type {ImageSource,ImageSelection} from '../../purchase-image-protocol';
import type {ImageReviewRow} from './imageReview';import type {PurchaseItem} from './purchase/types';
const normalized=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}ᆞ]/gu,'');
function similarity(a:string,b:string){if(a===b)return 1;if(a.length<3||b.length<3)return 0;const grams=(s:string)=>new Set(Array.from({length:s.length-1},(_,i)=>s.slice(i,i+2))),x=grams(a),y=grams(b);let common=0;for(const pair of x)if(y.has(pair))common++;return 2*common/(x.size+y.size);}
export function similarImages(a:ImageSource,b:ImageSource):boolean{
 if(a.sha256===b.sha256)return true;const x=a.perceptualHash,y=b.perceptualHash;if(!x||!y||!/^[a-f0-9]{16}$/.test(x)||!/^[a-f0-9]{16}$/.test(y)||/^(0+|f+)$/.test(x)||/^(0+|f+)$/.test(y)||Math.abs((a.width/a.height)/(b.width/b.height)-1)>.15)return false;
 let distance=0;for(let i=0;i<16;i++){let n=parseInt(x[i],16)^parseInt(y[i],16);while(n){distance+=n&1;n>>>=1;}}return distance<=6;
}
export type DuplicateCandidate={rowId:string;otherId:string;kind:'exact'|'similar';reason:string};
export function duplicateCandidates(rows:readonly ImageReviewRow[],existing:readonly PurchaseItem[]):DuplicateCandidate[]{
 const candidates:DuplicateCandidate[]=[];const all=[...rows.map(r=>({id:r.id,name:r.name,option:[r.option,r.specification].filter(Boolean).join(' · ')})),...existing.map(r=>({id:'existing:'+r.id,name:r.name,option:r.specification}))];
 for(let i=0;i<rows.length;i++)for(let j=0;j<all.length;j++){if(i===j)continue;const a=all[i],b=all[j],nameA=normalized(a.name),nameB=normalized(b.name),optionA=normalized(a.option),optionB=normalized(b.option);if(!nameA||!nameB)continue;
  // Explicitly different options (including sizes, colors and pack quantities) stay distinct.
  if(optionA&&optionB&&optionA!==optionB)continue;
  const numbersA=nameA.match(/\d+/g)?.join(','),numbersB=nameB.match(/\d+/g)?.join(',');if(numbersA&&numbersB&&numbersA!==numbersB)continue;const score=similarity(nameA,nameB);if(score<.84)continue;const exact=nameA===nameB&&optionA===optionB;candidates.push({rowId:a.id,otherId:b.id,kind:exact?'exact':'similar',reason:exact?'상품명과 옵션·규격 일치':'유사한 상품명 또는 미확정 옵션 · 원본 확인 필요'});
 }
 return candidates;
}
export function reorderedSelection(selection:ImageSelection,sourceId:string,direction:-1|1):ImageSelection{const index=selection.sources.findIndex(s=>s.id===sourceId),target=index+direction;if(index<0||target<0||target>=selection.sources.length)return selection;const sources=[...selection.sources];[sources[index],sources[target]]=[sources[target],sources[index]];return {...selection,sources:sources.map((s,i)=>({...s,order:i+1}))};}
