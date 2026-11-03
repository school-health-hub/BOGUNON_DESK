import {randomUUID} from 'node:crypto';
import {validAdminDate,authSecret,type AdminColumn,type AdminMapping,type AdminReview,type AdminTable} from '../admin-protocol.js';
export function validateAdminRows(value:unknown):string[][]{
 if(!Array.isArray(value)||!value.length||value.length>530)throw Error('표는 530행 이내여야 합니다.');
 for(const row of value){if(!Array.isArray(row)||row.length>256||row.some(cell=>typeof cell!=='string'||cell.length>65536||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(cell)))throw Error('열 수·셀 형식을 확인해 주세요.');}if(Buffer.byteLength(JSON.stringify(value))>4*1024*1024)throw Error('표 크기 4 MiB 제한을 초과했습니다.');return value as string[][];
}
const formula=(value:string)=>/^[=+@-]/.test(value.trim())&&!/^-(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim());
export function mapAdminTable(table:AdminTable,value:unknown):AdminReview{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='columns,generation,headerRow')throw Error('열 연결 형식을 확인해 주세요.');
 const input=value as AdminMapping;if(input.generation!==table.generation||!Number.isInteger(input.headerRow)||input.headerRow<0||input.headerRow>=Math.min(30,table.rows.length)||!Array.isArray(input.columns)||!input.columns.length||input.columns.length>16)throw Error('머리글·연결 열을 확인해 주세요.');
 const used=new Set<number>(),labels=new Set<string>();for(const column of input.columns){if(!column||Object.keys(column).sort().join(',')!=='label,required,sourceColumn,type'||typeof column.label!=='string'||!column.label.trim()||column.label.length>100||/[\t\r\n\0]/.test(column.label)||formula(column.label)||labels.has(column.label.trim())||!Number.isInteger(column.sourceColumn)||column.sourceColumn<0||column.sourceColumn>=table.rows[input.headerRow].length||used.has(column.sourceColumn)||!['text','number','date'].includes(column.type)||typeof column.required!=='boolean')throw Error('중복·잘못된 열 연결입니다.');used.add(column.sourceColumn);labels.add(column.label.trim());}
 const rows=table.rows.slice(input.headerRow+1).map((row,index)=>({row,index})).filter(({row})=>row.some(cell=>cell.trim())).map(({row,index})=>{
  const values=input.columns.map(c=>(row[c.sourceColumn]??'').trim()),issues:string[]=[];
  input.columns.forEach((column:AdminColumn,i:number)=>{const cell=values[i];if(column.required&&!cell)issues.push(`${column.label}: 필수값`);if(authSecret.test(cell))issues.push(`${column.label}: 인증정보 입력 금지`);if(formula(cell))issues.push(`${column.label}: 수식 형태`);if(cell&&column.type==='number'&&(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(cell)||!Number.isFinite(Number(cell.replace(/,/g,'')))||Math.abs(Number(cell.replace(/,/g,'')))>Number.MAX_SAFE_INTEGER))issues.push(`${column.label}: 숫자 형식`);if(cell&&column.type==='date'&&!validAdminDate(cell))issues.push(`${column.label}: YYYY-MM-DD 날짜`);if(/[\t\r\n]/.test(cell))issues.push(`${column.label}: 복사 전 줄바꿈·탭 정리 필요`);});
  return {sourceRow:input.headerRow+index+2,values,issues};
 });if(Buffer.byteLength(JSON.stringify(rows))>2*1024*1024)throw Error('검토 크기 2 MiB 제한을 초과했습니다.');if(!rows.length||rows.length>500)throw Error('검토 행은 1~500개만 지원합니다.');return {id:randomUUID(),generation:table.generation,headers:input.columns.map(c=>c.label.trim()),rows};
}
export function selectAdminRows(review:AdminReview,value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='reviewId,rowIndexes')throw Error('선택 행을 확인해 주세요.');const v=value as {reviewId:unknown;rowIndexes:unknown};if(v.reviewId!==review.id||!Array.isArray(v.rowIndexes)||!v.rowIndexes.length||v.rowIndexes.length>500||new Set(v.rowIndexes).size!==v.rowIndexes.length)throw Error('검토 결과가 변경되었습니다.');
 const rows=v.rowIndexes.map(index=>{if(!Number.isInteger(index)||index<0||index>=review.rows.length||review.rows[index].issues.length)throw Error('오류 없는 검토 행만 선택해 주세요.');return review.rows[index].values;});if(Buffer.byteLength(JSON.stringify([review.headers,...rows]))>500000)throw Error('선택 크기를 줄여 주세요.');return rows;
}
