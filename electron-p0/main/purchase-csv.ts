import { randomUUID } from 'node:crypto';
import type { PurchaseAnalysisResult, PurchaseColumnMapping, PurchaseHeaderOption, PurchaseItem, PurchaseMappingCandidate } from '../renderer/purchase/purchase/types.js';
export const CSV_LIMITS={bytes:15*1024*1024,rows:530,items:500,columns:256,cell:65536} as const;
const aliases:Record<string,string[]>={name:['품명','품목명','물품명','상품명','제품명','상품','제품','내역','내용','name','itemname'],specification:['규격','사양','옵션','모델','모델명','spec','specification'],quantity:['수량','주문수량','개수','qty'],unitPrice:['단가','가격','판매가','공급단가','예상단가','unitprice'],amount:['금액','합계금액','공급가액','소계','총액','amount'],vendor:['구매처','업체','업체명','공급업체','공급자','판매처','상호'],note:['비고','메모','remark','remarks'],budgetItem:['예산항목','예산','예산과목','세부사업','비목']};
const normalize=(s:string)=>s.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const summaryLabels=new Set(['합계','총계','소계','총액','total','subtotal','grandtotal']);
const labeledSummaryAmount=/^(?:(?:예상|최종)\s*)?(?:합계|총계|소계|총액)\s*(?::|：|-)?\s*[+-]?\d[\d,]*(?:\.\d+)?\s*원?$/iu;
const isSummaryName=(name:string)=>summaryLabels.has(normalize(name))||labeledSummaryAmount.test(name.trim());
const fieldFor=(s:string)=>Object.keys(aliases).find(key=>aliases[key].includes(normalize(s)));
const signature=(row:readonly string[])=>{const values=row.map(normalize);while(values.at(-1)==='')values.pop();return values;};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function decodeCsv(bytes:Uint8Array):string {
 if(bytes.length>CSV_LIMITS.bytes)throw Error('CSV 파일은 15 MiB 이하만 지원합니다.');
 let text:string;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{
  try{text=new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}catch{throw Error('UTF-8 또는 EUC-KR 인코딩을 확인해 주세요.');}
 }
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/u.test(text))throw Error('손상되었거나 텍스트가 아닌 CSV입니다.');
 return text.replace(/^\uFEFF/,'');
}
/** Bounded RFC4180 records; flexible widths match Rust csv ReaderBuilder.flexible(true).
 * Unlike csv crate's permissive quote recovery, malformed quotes are rejected. */
export function csvRows(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false,started=false;
 const append=()=>{
  if(cell.length>CSV_LIMITS.cell||row.length>=CSV_LIMITS.columns)throw Error('CSV 열 수 또는 셀 크기 제한을 초과했습니다.');
  const v=cell.trim();
  // Never evaluate formulas; reject formula-like cells before they can reach either clipboard format.
  if(/^[=+@-]/.test(v)&&!/^-[0-9]+(?:[.,][0-9]+)*$/.test(v))throw Error('수식으로 시작하는 CSV 셀은 가져올 수 없습니다.');
  row.push(cell);cell='';closed=false;started=false;
 };
 const end=()=>{const record=started||closed||cell!==''||row.length>0;append();if(record){if(rows.length>=CSV_LIMITS.rows)throw Error('CSV는 머리글 포함 530행까지만 지원합니다.');rows.push(row);}row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c===',')append();
  else if(c==='\r'||c==='\n'){end();if(c==='\r'&&text[i+1]==='\n')i++;}
  else if(c==='"'){if(started||closed)throw Error('CSV 따옴표 형식이 올바르지 않습니다.');quoted=true;started=true;}
  else{if(closed)throw Error('CSV 따옴표 뒤의 문자를 확인해 주세요.');started=true;cell+=c;}
  if(cell.length>CSV_LIMITS.cell)throw Error('CSV 셀 크기 제한을 초과했습니다.');
 }
 if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');
 if(started||closed||cell||row.length)end();
 return rows;
}
export function headerOptions(rows:readonly (readonly string[])[]):PurchaseHeaderOption[]{
 return rows.slice(0,30).flatMap((row,rowIndex)=>{
  const sig=signature(row),nonempty=sig.filter(Boolean).length;
  const consistent=rows.slice(rowIndex+1,rowIndex+6).filter(next=>next.filter(v=>v.trim()).length>=2&&next.length>=sig.length).length;
  return nonempty>=2&&consistent>0?[{rowIndex,headers:row,signature:sig,recommended:false,score:nonempty+consistent+row.filter(v=>fieldFor(v)).length*2}]:[];
 }).sort((a,b)=>b.score-a.score||a.rowIndex-b.rowIndex).slice(0,5).map(({score:_,...o},i)=>({...o,recommended:i===0}));
}
const number=(s:string):number|null=>{
 const cleaned=s.replace(/[^0-9.\-]/g,'');
 if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned))return null;
 const value=Number(cleaned);if(!Number.isFinite(value))throw Error('CSV 숫자 범위를 초과했습니다.');return value;
};
export function parseMappedRows(rows:readonly (readonly string[])[],source:string,header:number,mapping:PurchaseColumnMapping,automatic=false):PurchaseItem[]{
 const used=new Set<number>();
 if(!Number.isInteger(header)||header<0||header>=Math.min(30,rows.length)||(!automatic&&mapping.name===undefined))throw Error('품명에 연결할 원본 열을 선택해 주세요.');
 for(const [key,index] of Object.entries(mapping)){
  if(!Object.hasOwn(aliases,key)||!Number.isInteger(index)||index!<0||index!>=rows[header].length||used.has(index!))throw Error('열 연결을 확인해 주세요.');used.add(index!);
 }
 const sig=signature(rows[header]),items:PurchaseItem[]=[];
 rows.slice(header+1).forEach((row,offset)=>{
  if(row.every(v=>!v.trim())||same(sig,signature(row)))return;
  const get=(field:keyof PurchaseColumnMapping)=>(row[mapping[field]??-1]??'').trim();
  const name=get('name');if(isSummaryName(name))return;
  const quantityRaw=get('quantity'),priceRaw=get('unitPrice');
  const quantity=number(quantityRaw),unitPrice=number(priceRaw),importedAmount=number(get('amount'));
  const specification=get('specification'),vendor=get('vendor'),note=get('note'),budgetItem=get('budgetItem');
  if(!name&&quantity===null&&unitPrice===null&&importedAmount===null)return;
  if(!name&&!specification&&quantity===null&&unitPrice===null&&importedAmount!==null&&!vendor&&!note&&!budgetItem)return;
  const issues:PurchaseItem['issues'][number][]=[];
  if(!name)issues.push('missingName');
  if((quantityRaw&&quantity===null)||(quantity!==null&&quantity<=0))issues.push('invalidQuantity');
  if((priceRaw&&unitPrice===null)||(unitPrice!==null&&unitPrice<0))issues.push('invalidUnitPrice');
  if(quantity!==null&&unitPrice!==null){const amount=quantity*unitPrice;if(!Number.isFinite(amount)||Math.abs(amount)>Number.MAX_SAFE_INTEGER)throw Error('CSV 금액 범위를 초과했습니다.');if(importedAmount!==null&&Math.abs((amount<0?-Math.round(-amount):Math.round(amount))-importedAmount)>=1)issues.push('amountMismatch');}
  items.push({id:`import-${items.length}-${offset}`,selected:true,name,specification,quantity,unitPrice,importedAmount,vendor,note,budgetItem,sourceName:source,issues,amountMismatchReviewed:false});
 });
 if(items.length>CSV_LIMITS.items)throw Error('파일당 품목은 최대 500개까지 가져올 수 있습니다.');
 return items;
}
export function analyzeCsv(bytes:Uint8Array,source:string):PurchaseAnalysisResult {
 const rows=csvRows(decodeCsv(bytes));
 let best:{header:number;mapping:PurchaseColumnMapping;score:number}|undefined;
 rows.slice(0,30).forEach((row,header)=>{
  const mapping:Record<string,number>={};row.forEach((v,i)=>{const field=fieldFor(v);if(field)mapping[field]=i;});
  const score=Object.keys(mapping).length;
  if((score>=3||(mapping.name!==undefined&&['quantity','unitPrice','amount'].some(f=>mapping[f]!==undefined)))&&(!best||score>best.score))best={header,mapping,score};
 });
 if(best){const {header,mapping}=best;const items=parseMappedRows(rows,source,header,mapping,true).map((item,i)=>({...item,id:`purchase-0-${i}`}));return {items,sources:[{sourceName:source,status:'success',rowCount:items.length,message:null}],candidates:[]};}
 const options=headerOptions(rows);
 if(!options.length)throw Error('품목 표의 머리글을 찾지 못했습니다.');
 const candidate:PurchaseMappingCandidate={id:randomUUID(),sourceName:source,sheetName:'CSV',rows,headerOptions:options};
 return {items:[],sources:[{sourceName:source,status:'needsMapping',rowCount:0,message:'열 구성을 확인해 주세요.',candidateId:candidate.id}],candidates:[candidate]};
}
