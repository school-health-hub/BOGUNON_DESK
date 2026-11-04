import {IMAGE_IMPORT_LIMITS,type ImageSelection,type ImageAnalysis,type ImageBox,type OcrLine} from '../../purchase-image-protocol';
import type {ImageReviewRow,ImageCharge,ReviewField} from './imageReview';
type Segment={text:string;confidence:number;box:ImageBox;layoutBox:ImageBox;index:number;field?:ReviewField|'originalPrice'|'discount';value?:string;priority?:number};
const clean=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
const fields:readonly [string,NonNullable<Segment['field']>,number][]=[['상품명|품명|제품명|product name','name',0],['옵션|선택사항|선택\\s*옵션|선택|색상|컬러|사이즈|option|size|color','option',0],['규격|입수|묶음 구성|specification|pack size','specification',0],['주문\\s*수량|구매\\s*수량|수량|quantity|qty','quantity',0],['적용\\s*단가|최종\\s*단가|할인\\s*단가|할인가|최종가|applied price','unitPrice',3],['단가|unit price','unitPrice',2],['판매가|판매가격|sale price','unitPrice',1],['상품\\s*금액|상품\\s*소계|금액|소계|subtotal','amount',0],['할인\\s*전\\s*가격|정상가|정가|original price|list price','originalPrice',0],['상품\\s*할인|product discount','discount',0]];
const inline=new RegExp(`(?:^|\\s|[|;/])(${fields.map(f=>f[0]).join('|')})\\s*[:：]\\s*`,'gi');
function classify(s:Segment):Segment{for(const [pattern,field,priority] of fields){const match=s.text.match(new RegExp(`^(${pattern})(?:\\s*[:：]\\s*|\\s+(?=\\S)|(?=[₩\\d]))(.*)$`,'i'));if(match)return {...s,field,value:clean(match[2]),priority};}return s;}
function segments(lines:readonly OcrLine[]):Segment[]{
 const result:Segment[]=[];
 for(const [index,line] of lines.entries()){
  const parts:{text:string;box:ImageBox;layoutBox:ImageBox}[]=[];
  if(line.words&&line.words.length>1){const words=[...line.words].sort((a,b)=>(a.layoutBox??a.box)[0]-(b.layoutBox??b.box)[0]),groups:typeof words[]=[[]];const threshold=Math.max(90,((line.layoutBox??line.box)[3]-(line.layoutBox??line.box)[1])*4);
   for(const word of words){const active=groups[groups.length-1],last=active[active.length-1];if(last&&(word.layoutBox??word.box)[0]-(last.layoutBox??last.box)[2]>threshold)groups.push([]);groups[groups.length-1].push(word);}
   if(groups.length>1)for(const group of groups){if(group.length)parts.push({text:group.map(w=>w.text).join(' '),box:[Math.min(...group.map(w=>w.box[0])),Math.min(...group.map(w=>w.box[1])),Math.max(...group.map(w=>w.box[2])),Math.max(...group.map(w=>w.box[3]))],layoutBox:[Math.min(...group.map(w=>(w.layoutBox??w.box)[0])),Math.min(...group.map(w=>(w.layoutBox??w.box)[1])),Math.max(...group.map(w=>(w.layoutBox??w.box)[2])),Math.max(...group.map(w=>(w.layoutBox??w.box)[3]))]});}
  }
  if(!parts.length)parts.push({text:line.text,box:line.box,layoutBox:line.layoutBox??line.box});
  for(const part of parts){const text=clean(part.text),matches=[...text.matchAll(inline)];if(matches.length){if(matches[0].index!>0){const prefix=text.slice(0,matches[0].index).trim();if(prefix)result.push(classify({text:prefix,box:part.box,layoutBox:part.layoutBox,confidence:line.confidence,index}));}for(let i=0;i<matches.length;i++){const start=matches[i].index!+matches[i][0].indexOf(matches[i][1]),end=matches[i+1]?.index??text.length;result.push(classify({text:text.slice(start,end),box:part.box,layoutBox:part.layoutBox,confidence:line.confidence,index}));}}else if(text)result.push(classify({text,box:part.box,layoutBox:part.layoutBox,confidence:line.confidence,index}));}
 }
 return result.sort((a,b)=>a.layoutBox[1]-b.layoutBox[1]||a.layoutBox[0]-b.layoutBox[0]||a.index-b.index);
}
function charge(text:string):ImageCharge['kind']|null{if(/배송비|배송료|shipping fee/i.test(text))return 'shipping';if(/주문\s*할인|쿠폰\s*할인|총\s*할인|order discount/i.test(text))return 'discount';if(/주문\s*(총액|합계|금액)|예상\s*합계|상품\s*금액\s*합계|총\s*(결제|상품금액|합계)|결제\s*(예정|금액)|^(합계|주문총액|order total|total)\s*[:：]?/i.test(text))return 'total';return null;}
const header=(text:string)=>/장바구니|검토 자료|전체 선택|선택 삭제|주문하기|구매하기|판매자|^상품명\s+.*수량.*단가|^cart$|^checkout$/i.test(text);
function amount(text:string){const m=text.match(/^(?:₩\s*|KRW\s*)?((?:\d+|\d{1,3}(?:,\d{3})+))\s*(?:원|KRW)?$/i);return m?m[1].replace(/,/g,''):'';}
export function parseCartLayout(selection:ImageSelection,analysis:ImageAnalysis):{rows:ImageReviewRow[];charges:ImageCharge[]}{
 const rows:ImageReviewRow[]=[],charges:ImageCharge[]=[];
 for(const source of selection.sources){const result=analysis.results.find(r=>r.sourceId===source.id);if(result?.status!=='success')continue;const all=segments(result.lines),content:Segment[]=[];
  for(const segment of all){const kind=charge(segment.text);if(kind){charges.push({sourceId:source.id,text:segment.text,lineIndex:segment.index,kind});}else if(!header(segment.text))content.push(segment);}
  const anchors=content.filter(s=>s.field==='name'||(!s.field&&!/[:：=]/.test(s.text)&&/[가-힣A-Za-z]{2}/.test(s.text)&&!/[₩]|\d[\d,]*\s*원|^\d+\s*(개|팩|매|세트)/.test(s.text)&&content.some(other=>other!==s&&other.field&&other.field!=='name'&&other.layoutBox[1]>=s.layoutBox[1]&&other.layoutBox[1]-s.layoutBox[1]<Math.max(180,(s.layoutBox[3]-s.layoutBox[1])*8))));
  const layoutWidth=Math.max(400,...content.map(s=>s.layoutBox[2]));const columns:number[]=[];for(const anchor of [...anchors].sort((a,b)=>a.layoutBox[0]-b.layoutBox[0]))if(!columns.some(x=>Math.abs(x-anchor.layoutBox[0])<layoutWidth*.25))columns.push(anchor.layoutBox[0]);if(!columns.length)columns.push(0);
  const col=(x:number)=>{let chosen=0;for(let i=1;i<columns.length;i++)if(x>=columns[i]-Math.min(80,(columns[i]-columns[i-1])*.12))chosen=i;return chosen;};
  const groups:{anchor:Segment;row:ImageReviewRow;column:number;pricePriority:number;conflicts:Set<string>}[]=[];
  const add=(anchor:Segment)=>{if(rows.length>=IMAGE_IMPORT_LIMITS.reviewRows)throw new RangeError('검토 품목이 200개를 초과했습니다. 이미지를 나누어 분석해 주세요.');const row:ImageReviewRow={id:`${source.id}-${rows.length}`,sourceId:source.id,name:anchor.field==='name'?anchor.value??'':anchors.includes(anchor)?anchor.text:'',option:'',specification:'',quantity:'',unitPrice:'',amount:'',originalPrice:'',discount:'',lineIndices:[],warnings:[],approved:false,fieldEvidence:{},fieldBoxes:{},confidences:{},priceCandidates:[]};rows.push(row);const group={anchor,row,column:col(anchor.layoutBox[0]),pricePriority:0,conflicts:new Set<string>()};groups.push(group);if(anchor.field!=='name')row.warnings.push('상품명 경계를 자동 제안했습니다. 원본에서 확인해 주세요.');return group;};
  for(const anchor of anchors)add(anchor);
  for(const segment of content){let group=groups.find(g=>g.anchor===segment);if(!group)group=groups.filter(g=>g.column===col(segment.layoutBox[0])&&g.anchor.layoutBox[1]<=segment.layoutBox[1]+4).sort((a,b)=>b.anchor.layoutBox[1]-a.anchor.layoutBox[1])[0];if(!group){if(!segment.field)continue;group=add(segment);}const row=group.row;if(!row.lineIndices.includes(segment.index))row.lineIndices.push(segment.index);
   let field=segment.field;let value=segment.value??segment.text;
   if(!field&&/^\d+\s*개$/.test(segment.text)){field='quantity';value=segment.text;row.warnings.push('주문 수량 후보입니다. 묶음 구성 수량과 구분해 주세요.');}
   if(!field){const candidates=segment.text.match(/(?:₩\s*)?\d[\d,]*\s*원/g);if(candidates){row.priceCandidates!.push(...candidates.map(v=>({label:'역할 미확정 가격',value:v,lineIndex:segment.index})));row.warnings.push('단가·할인 전 가격·상품금액의 역할이 불명확합니다. 원문을 보고 직접 지정해 주세요.');}else if(group.anchor===segment)field='name';else row.warnings.push('구조화하지 못한 문구가 있습니다. 원문을 확인해 주세요.');if(!field)continue;}
   const canonical=field;
   row.fieldEvidence![canonical]=[...(row.fieldEvidence![canonical]??[]),segment.index];row.fieldBoxes![canonical]=[...(row.fieldBoxes![canonical]??[]),segment.box];row.confidences![canonical]=Math.min(row.confidences![canonical]??100,segment.confidence);
   if(segment.confidence<85)row.warnings.push(`${canonical==='name'?'상품명':canonical==='quantity'?'수량':canonical==='unitPrice'?'단가':canonical==='amount'?'금액':'옵션·규격'} 인식 신뢰도가 낮습니다.`);
   if(field==='name'){row.name=value;continue;}if(field==='option'||field==='specification'){row[field]=clean([row[field],value].filter(Boolean).join(' · '));continue;}
   if(field==='quantity'){const q=value.match(/^(\d+)\s*(?:개|세트|상자|팩)?$/);if(!q){row.warnings.push('수량과 묶음 구성을 직접 구분해 주세요.');continue;}value=q[1];}
   else{const price=amount(value);row.priceCandidates!.push({label:segment.text.split(/[:：]/)[0],value:price||value,lineIndex:segment.index});if(!price){row.warnings.push('가격 인식 결과를 직접 확인해 주세요.');continue;}value=price;}
   if(field==='unitPrice'){const priority=segment.priority??0;if(priority<group.pricePriority)continue;if(priority>group.pricePriority){row.unitPrice=value;group.pricePriority=priority;group.conflicts.delete('unitPrice');continue;}}
   if(group.conflicts.has(field))continue;if(row[field]&&row[field]!==value){row[field]='';group.conflicts.add(field);row.warnings.push(`${field==='quantity'?'수량':'가격'} 후보가 서로 다릅니다. 직접 지정해 주세요.`);}else row[field]=value;
  }
 }
 return {rows,charges};
}
