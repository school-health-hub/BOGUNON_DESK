import{readFile}from'node:fs/promises';import{randomUUID}from'node:crypto';import{sql}from'../server/database.js';
export{createTaskSession}from'../server/session.js';export{A,B,mid}from'../../school02/tests/fixtures.js';
export async function reset(){for(const p of ['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql'])await sql(await readFile(p,'utf8'));}
export const createArgs=(school:string,assignees:string[]=[])=>({p_school_id:school,p_title:'보건교육 자료 준비',p_description:'자료 목록을 확인합니다.',p_priority:'NORMAL'as const,p_due_date:null,p_assignees:assignees,p_request_id:randomUUID()});
export const listArgs=(school:string)=>({p_school_id:school,p_status:null,p_sort:'DUE',p_scope:'ALL',p_include_archived:false});
