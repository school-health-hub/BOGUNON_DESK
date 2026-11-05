import{readFile}from'node:fs/promises';import{sql}from'../server/database.js';
export{createSchoolSession}from'../server/session.js';
export const A='10000000-0000-0000-0000-000000000001',B=A.slice(0,-1)+'2',NEW=A.slice(0,-1)+'4';
export const mid=(i:number)=>`20000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
export async function reset(){for(const p of ['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql'])await sql(await readFile(p,'utf8'));}
