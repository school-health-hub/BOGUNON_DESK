import {it,expect} from 'vitest';
import {emptyAdmin,officialAdminUrl,renderLeaveDraft,validateLeaveDraft,validateAdminDocument,validateAdminTemplate,type LeaveDraft,type AdminTable} from '../admin-protocol';
import {mapAdminTable,selectAdminRows,validateAdminRows} from '../main/admin-table';
export const draft:LeaveDraft={id:'synthetic-draft',system:'neis',kind:'연가',startDate:'2026-11-04',endDate:'2026-11-04',startTime:'09:00',endTime:'18:00',reason:'합성 복무 사유',text:'합성 검토 초안'};
it('accepts official HTTPS home addresses only; never saves credentials or arbitrary launch URLs',()=>{
 expect(officialAdminUrl('https://synthetic.eduptl.kr')).toBe('https://synthetic.eduptl.kr/');for(const url of ['javascript:alert(1)','file:///C:/private','http://synthetic.neis.go.kr/','https://synthetic.neis.go.kr.evil.test/','https://user:password@synthetic.neis.go.kr/','https://synthetic.neis.go.kr/?token=secret','https://synthetic.neis.go.kr:444/','https://127.0.0.1/','https://evil.test/'])expect(()=>officialAdminUrl(url)).toThrow();
});
it('renders literal configurable placeholders and preserves user-edited text in local snapshots',()=>{
 const template=emptyAdmin().templates.neis,text=renderLeaveDraft(template,draft);expect(text).toContain('연가');expect(text).toContain('2026-11-04 09:00');const document={...emptyAdmin(),drafts:[{...draft,text:text+'\n합성 직접 수정'}]};expect(validateAdminDocument(document)).toEqual(document);expect(()=>validateAdminTemplate('{{알수없는항목}}')).toThrow();expect(()=>validateAdminTemplate('{{사유')).toThrow();expect(renderLeaveDraft('{{사유}}',{...draft,reason:'$& 문자는 그대로'})).toBe('$& 문자는 그대로');
});
it('rejects invalid periods, zero duration, impossible dates and credential-containing drafts/settings',()=>{
 for(const patch of [{startTime:'18:00',endTime:'09:00'},{endTime:'09:00'},{startDate:'2026-02-30'},{reason:''},{text:'비밀번호: synthetic-private'},{kind:'기타'}])expect(()=>validateLeaveDraft({...draft,...patch})).toThrow();expect(()=>validateAdminDocument({...emptyAdmin(),password:'no'})).toThrow();expect(()=>validateAdminDocument({...emptyAdmin(),drafts:[draft,draft]})).toThrow();
});
const table:AdminTable={generation:1,sourceName:'synthetic.csv',sheetName:'CSV',rows:[['항목','수량','일자'],['합성 점검','1,000','2026-11-04'],['합성 잘못된 행','abc','2026-02-30'],['','2','2026-11-04']]};
const columns=[{label:'업무',sourceColumn:0,type:'text' as const,required:true},{label:'검토 수량',sourceColumn:1,type:'number' as const,required:true},{label:'검토 일자',sourceColumn:2,type:'date' as const,required:false}];
it('maps original row numbers, validates required/date/number cells and exports only selected valid rows',()=>{
 const review=mapAdminTable(table,{generation:1,headerRow:0,columns});expect(review.rows[0]).toEqual({sourceRow:2,values:['합성 점검','1,000','2026-11-04'],issues:[]});expect(review.rows[1].issues).toHaveLength(2);expect(review.rows[2].issues).toContain('업무: 필수값');expect(selectAdminRows(review,{reviewId:review.id,rowIndexes:[0]})).toEqual([review.rows[0].values]);for(const rowIndexes of [[1],[0,0],[99],[]])expect(()=>selectAdminRows(review,{reviewId:review.id,rowIndexes})).toThrow();expect(()=>selectAdminRows(review,{reviewId:'stale',rowIndexes:[0]})).toThrow();
});
it('blocks stale/duplicate mappings, formula-like rows, controls and oversized tables',()=>{
 expect(()=>mapAdminTable(table,{generation:0,headerRow:0,columns})).toThrow();expect(()=>mapAdminTable(table,{generation:1,headerRow:0,columns:[columns[0],columns[0]]})).toThrow();expect(()=>validateAdminRows([['\0']])).toThrow();expect(()=>validateAdminRows(Array(531).fill(['x']))).toThrow();
 const review=mapAdminTable({...table,rows:[['값'],[' =cmd()'],['password: synthetic-private']]},{generation:1,headerRow:0,columns:[columns[0]]});expect(review.rows[0].issues).toContain('업무: 수식 형태');expect(review.rows[1].issues).toContain('업무: 인증정보 입력 금지');
});
