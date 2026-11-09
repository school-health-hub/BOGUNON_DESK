import {it,expect,beforeEach,afterAll} from 'vitest';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';import {readFile} from 'node:fs/promises';
import {createInstructorSession} from '../server/session.js';
import {literal,localDockerArgs} from '../../integration/server/local-db.js';
import type {HealthSupportInstructorInput} from '../core/validation.js';
const container=process.env.INSTRUCTOR_TEST_CONTAINER??'bogunon-school05-pg';if(!['bogunon-school05-pg','bogunon-instructor02-local'].includes(container))throw Error('local_test_container_required');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'].includes(k)));
class LocalPsql{
 #child:ChildProcessWithoutNullStreams|undefined;#tail=Promise.resolve();#sequence=0;
 constructor(readonly user:string){}
 query(q:string,signal?:AbortSignal):Promise<string>{const run=this.#tail.then(()=>this.#run(q,signal));this.#tail=run.then(()=>undefined,()=>undefined);return run;}
 #run(q:string,signal?:AbortSignal):Promise<string>{return new Promise((resolve,reject)=>{
  const child=this.#child??this.#start(),marker=`__BOGUNON_QUERY_${++this.#sequence}__`;let output='',errors='';
  const abort=()=>child.kill();const stderr=(bytes:Buffer)=>{errors+=bytes.toString();};
  const cleanup=()=>{signal?.removeEventListener('abort',abort);child.stdout.off('data',stdout);child.stderr.off('data',stderr);child.off('close',closed);};
  const stdout=(bytes:Buffer)=>{output+=bytes.toString();const end=output.indexOf(`${marker} `);if(end<0)return;const lineEnd=output.indexOf('\n',end);if(lineEnd<0)return;cleanup();const status=output.slice(end+marker.length+1,lineEnd).trim(),result=output.slice(0,end).trim();if(status!=='00000'){if(this.#child===child)this.#child=undefined;child.kill();reject(new Error(errors.trim()||`local_psql_${status}`));}else resolve(result);};
  const closed=()=>{cleanup();reject(new Error(errors.trim()||'local_psql_closed'));};
  signal?.addEventListener('abort',abort,{once:true});child.stdout.on('data',stdout);child.stderr.on('data',stderr);child.once('close',closed);
  child.stdin.write(`${q};\n\\echo ${marker} :LAST_ERROR_SQLSTATE\n`,error=>{if(error)closed();});
 });}
 #start(){const child=spawn('docker',[...localDockerArgs(),'exec','-i',container,'psql','-X','-qAt','-U',this.user,'-d','school01a'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});this.#child=child;child.stdin.on('error',()=>child.kill());child.once('close',()=>{if(this.#child===child)this.#child=undefined;});return child;}
 close(){this.#child?.kill();}
}
const sessions=new Map<string,LocalPsql>();
export async function sql(q:string,user='postgres',signal?:AbortSignal){let session=sessions.get(user);if(!session){session=new LocalPsql(user);sessions.set(user,session);}return session.query(q,signal);}
afterAll(()=>{for(const session of sessions.values())session.close();sessions.clear();});
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002';
const settings:HealthSupportInstructorInput={name:'합성 강사',subject:'학교보건지원',weeklyHours:14,hourlyRate:30000,monthlyInsurance:45000,weeklyHourLimit:15,monthlyHourLimit:60,totalBudget:500000,operationStartDate:'2026-08-01',operationEndDate:'2026-12-31'};
const fixtureFiles=['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql']as const;
const resetSql=['BEGIN;','TRUNCATE workspace.instructor_schedules;',...await Promise.all(fixtureFiles.map(file=>readFile(file,'utf8'))),'COMMIT;'].join('\n');
beforeEach(async()=>{await sql(resetSql);});
async function client(index=3,kind:'electron'|'web'='electron'){const rig=createInstructorSession(kind,index,{execute:sql});await rig.school.controller.command('login');await rig.school.controller.command('select',{school:index===6?B:A});return rig;}
const base={school:A,month:'2026-08'};
async function setup(){const r=await client(),v=await r.instructor.command('settings',{...base,version:0,request_id:crypto.randomUUID(),payload:settings});expect(v.phase).toBe('ready');return {r,b:v.board!};}
const row=(id:string)=>({instructorId:id,date:'2026-08-04',startTime:'09:00',endTime:'12:00',note:'교사 전용 합성 비고'});
it('LOCAL DB teacher saves; independent assistant session reads same schedule without financial/note fields; new session restores',async()=>{
 const {r,b}=await setup();const saved=await r.instructor.command('save',{...base,version:b.version,request_id:crypto.randomUUID(),payload:row(b.instructor!.id)});expect(saved.phase).toBe('ready');
 const a=await client(4,'web'),view=await a.instructor.command('read',base);expect(view.board?.schedule[0].hours).toBe(3);expect(view.board?.instructor).toBeNull();expect(view.board?.logs).toEqual([]);expect(JSON.stringify(view)).not.toMatch(/30000|45000|500000|교사 전용/);
 const again=await client();expect((await again.instructor.command('read',base)).board?.logs).toHaveLength(1);
});
it('LOCAL DB server blocks assistant direct RPC writes, cross school, anonymous and direct table reads',async()=>{
 const {b}=await setup(),a=await client(4);expect((await a.instructor.command('settings',{...base,version:1,request_id:crypto.randomUUID(),payload:settings})).phase).not.toBe('ready');
 const raw=async(r:Awaited<ReturnType<typeof client>>,fn:string)=>r.school.run(async token=>sql(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=${literal(JSON.stringify(r.school.registry.resolve(token)))};${fn};COMMIT;`,'school_client'));
 await expect(raw(a,`SELECT public.ws_v1_instructor_write('${A}','settings',${literal(JSON.stringify(settings))}::jsonb,1,'${crypto.randomUUID()}')`)).rejects.toThrow();
 const other=await client(6);await expect(raw(other,`SELECT public.ws_v1_instructor_read('${A}','2026-08')`)).rejects.toThrow();
 await expect(raw(a,'SELECT * FROM workspace.instructor_schedules')).rejects.toThrow();
 await expect(sql(`SET ROLE anon;SELECT public.ws_v1_instructor_read('${A}','2026-08')`)).rejects.toThrow();
 expect(await sql('SELECT count(*)FROM workspace.instructor_schedules')).toBe('1');expect(b.version).toBe(1);
});
it('LOCAL DB revision conflict, duplicate retries and atomic import errors preserve original rows',async()=>{
 const {r,b}=await setup(),request_id=crypto.randomUUID();const input={...base,version:1,request_id,payload:row(b.instructor!.id)};
 expect((await r.instructor.command('save',input)).phase).toBe('ready');expect((await r.instructor.command('save',input)).phase).toBe('ready');
 expect((await r.instructor.command('save',{...input,request_id:crypto.randomUUID()})).phase).toBe('error');
 const old=await sql('SELECT logs FROM workspace.instructor_schedules');
 expect((await r.instructor.command('import',{...base,version:2,request_id:crypto.randomUUID(),payload:[{...row(b.instructor!.id),date:'2026-08-05'},row(b.instructor!.id)]})).phase).toBe('error');
 expect(await sql('SELECT logs FROM workspace.instructor_schedules')).toBe(old);
});
it('LOCAL DB update/delete + no other school edits; revoked membership denies late access',async()=>{
 const {r,b}=await setup();const saved=await r.instructor.command('save',{...base,version:1,request_id:crypto.randomUUID(),payload:row(b.instructor!.id)});
 const log=saved.board!.logs[0];const changed=await r.instructor.command('save',{...base,version:2,request_id:crypto.randomUUID(),payload:{...log,endTime:'13:00'}});expect(changed.board?.schedule[0].hours).toBe(4);
 const deleted=await r.instructor.command('delete',{...base,version:3,id:log.id,request_id:crypto.randomUUID()});expect(deleted.board?.logs).toEqual([]);
 await r.school.controller.command('logout');expect((await r.instructor.command('read',base)).phase).not.toBe('ready');
});

it('LOCAL DB read-only projection uses original JS rounding and rejects malformed direct teacher payloads without data loss',async()=>{
 const {r,b}=await setup();const v=await r.instructor.command('save',{...base,version:1,request_id:crypto.randomUUID(),payload:{...row(b.instructor!.id),startTime:'09:00:00',endTime:'10:00:18'}});expect(v.board?.schedule[0].hours).toBe(1);
 const a=await client(4,'web');expect((await a.instructor.command('read',base)).board?.schedule[0].hours).toBe(1);
 const before=await sql('SELECT logs FROM workspace.instructor_schedules');
 await expect(r.school.run(async token=>sql(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=${literal(JSON.stringify(r.school.registry.resolve(token)))};SELECT public.ws_v1_instructor_write('${A}','settings',${literal(JSON.stringify({...settings,extraStamp:'not_allowed'}))}::jsonb,2,'${crypto.randomUUID()}');COMMIT;`,'school_client'))).rejects.toThrow();
 expect(await sql('SELECT logs FROM workspace.instructor_schedules')).toBe(before);
});
