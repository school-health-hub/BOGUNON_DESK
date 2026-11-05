import{beforeEach,describe,it,expect}from'vitest';import{randomUUID}from'node:crypto';
import{createSchoolSession,reset,A,B,NEW,mid}from'./fixtures.js';import{sql}from'../server/database.js';
import{deferred}from'../../auth/tests/fixtures.js';
const signal=()=>new AbortController().signal;
describe('LOCAL DB + actual B adapters/C coordinator, MOCK Auth/cipher only',()=>{
 beforeEach(reset);
 for(const kind of ['electron','web']as const){
 it(`${kind}: teacher/assistant requests -> admin approval/rejection -> refreshed role`,async()=>{
  const teacher=createSchoolSession(kind,11),assistant=createSchoolSession(kind,12),admin=createSchoolSession(kind,1);
  for(const x of[teacher,assistant,admin]){await x.controller.command('login');await x.controller.command('select',{school:A});}
  expect((await teacher.controller.command('join',{role:'HEALTH_TEACHER'})).self.memberships[0].status).toBe('pending');
  await assistant.controller.command('join',{role:'HEALTH_ASSISTANT'});
  await expect(teacher.controller.port.call('ws_v1_get_context',{p_school_id:A},signal())).rejects.toMatchObject({code:'ACCESS_DENIED'});
  let state=await admin.controller.command('refresh');expect(state.admin?.requests).toHaveLength(3);
  const t=teacher.controller.snapshot().self.memberships[0].member_code,ass=assistant.controller.snapshot().self.memberships[0].member_code;
  let req=state.admin!.requests.find(r=>r.member_code===t)!;
  await admin.controller.command('decide',{id:req.id,version:req.version,decision:'approve',role:'HEALTH_TEACHER'});
  state=await teacher.controller.command('refresh');expect(state.workspace.context?.role).toBe('HEALTH_TEACHER');expect(state.self.memberships[0].approved_at).toBeTruthy();
  req=(await admin.controller.command('refresh')).admin!.requests.find(r=>r.member_code===ass)!;
  await admin.controller.command('decide',{id:req.id,version:req.version,decision:'reject'});expect((await assistant.controller.command('refresh')).self.memberships[0].status).toBe('rejected');
 });}
 it('same-name directory preserves code strings and office disambiguation',async()=>{
  const x=createSchoolSession('web');await x.controller.command('login');let s=await x.controller.command('search',{name:'늘봄',office:''});expect(s.directory).toHaveLength(2);expect(s.directory.map(d=>d.school_code)).toEqual(['0000001','0000001']);expect(new Set(s.directory.map(d=>d.school_id)).size).toBe(2);
  await x.controller.command('select',{school:A.slice(0,-1)+'3'});expect((await x.controller.command('join',{role:'HEALTH_TEACHER'})).notice).toContain('권한');
  s=await x.controller.command('search',{name:'늘봄',office:'C10'});expect(s.directory[0].school_id).toBe(B);expect(s.directory).toHaveLength(1);
 });
 it('duplicate join blocked server-side and never becomes active',async()=>{
  const x=createSchoolSession('electron');await x.controller.command('login');await x.controller.command('select',{school:A});await x.controller.command('join',{role:'HEALTH_TEACHER'});const result=await x.controller.command('join',{role:'HEALTH_TEACHER'});expect(result.notice).toContain('이미 처리');expect(result.self.memberships[0].status).toBe('pending');
 });
 it('assistant approval requires future expiry; teacher admin role is not a join choice',async()=>{
  const x=createSchoolSession('web',12),admin=createSchoolSession('web',1);for(const r of[x,admin]){await r.controller.command('login');await r.controller.command('select',{school:A});}
  await x.controller.command('join',{role:'HEALTH_ASSISTANT'});let a=await admin.controller.command('refresh');const req=a.admin!.requests.find(j=>j.member_code===x.controller.snapshot().self.memberships[0].member_code)!;
  expect((await admin.controller.command('decide',{id:req.id,version:1,decision:'approve',role:'HEALTH_ASSISTANT'})).notice).toContain('기간');
  a=await admin.controller.command('decide',{id:req.id,version:1,decision:'approve',role:'HEALTH_ASSISTANT',until:new Date(Date.now()+86400000).toISOString()});expect(a.notice).toContain('확인');expect((await x.controller.command('refresh')).workspace.context?.role).toBe('HEALTH_ASSISTANT');
  const y=createSchoolSession('web',13);await y.controller.command('login');await y.controller.command('select',{school:A});await y.controller.command('join',{role:'SCHOOL_ADMIN'});expect(y.controller.snapshot().self.memberships).toHaveLength(0);
 });
 it('withdraw pending -> withdrawn display -> rejoin creates a new epoch',async()=>{
  const x=createSchoolSession('web');await x.controller.command('login');await x.controller.command('select',{school:A});let s=await x.controller.command('join',{role:'HEALTH_TEACHER'}),m=s.self.memberships[0];s=await x.controller.command('withdraw',{id:m.request!.id,version:m.request!.version});expect(s.self.memberships[0].request?.state).toBe('withdrawn');s=await x.controller.command('join',{role:'HEALTH_ASSISTANT'});expect(s.self.memberships[0].epoch).toBe(2);expect(s.self.memberships[0].role).toBeNull();
 });
 it('opening request is pending only; duplicate request and forged directory rejected',async()=>{
  const x=createSchoolSession('web');await x.controller.command('login');await x.controller.command('select',{school:NEW});let s=await x.controller.command('space');expect(s.self.space_requests).toContainEqual(expect.objectContaining({school_id:NEW,state:'pending'}));expect(s.workspace.phase).not.toBe('approved');
  expect((await x.controller.command('space')).notice).toContain('이미 처리');expect(await sql(`SELECT state FROM workspace.schools WHERE id='${NEW}'`)).toBe('unclaimed');expect(await sql(`SELECT count(*) FROM workspace.school_memberships WHERE school_id='${NEW}'`)).toBe('0');
  await sql(`UPDATE workspace.schools SET state='closed' WHERE id='${NEW}'`);const other=createSchoolSession('web',14);await other.controller.command('login');await other.controller.command('select',{school:NEW});expect((await other.controller.command('space')).notice).toContain('권한');
  await x.controller.command('select',{school:'10000000-0000-0000-0000-000000000009'});expect((await x.controller.command('space')).notice).toContain('권한');
 });
 it('self approval denied even with direct public RPC; no cross-school applicant access',async()=>{
  const pending=createSchoolSession('web',5),admin=createSchoolSession('web',6);for(const x of[pending,admin])await x.controller.command('login');
  await expect(pending.controller.port.call('ws_v1_decide_join',{p_school_id:A,p_join_request_id:'50000000-0000-0000-0000-000000000005',p_decision:'approve',p_approved_role:'HEALTH_TEACHER',p_valid_until:null,p_expected_version:1,p_request_id:randomUUID()},signal())).rejects.toMatchObject({code:'ACCESS_DENIED'});
  const self=createSchoolSession('web',1);await self.controller.command('login');
  // Privileged fixture injects an impossible normal-UI case to exercise the explicit self guard.
  await sql(`INSERT INTO workspace.join_requests(id,school_id,membership_id,epoch,requested_role) VALUES('50000000-0000-0000-0000-000000000001','${A}','${mid(1)}',1,'HEALTH_TEACHER')`);
  await expect(self.controller.port.call('ws_v1_decide_join',{p_school_id:A,p_join_request_id:'50000000-0000-0000-0000-000000000001',p_decision:'approve',p_approved_role:'HEALTH_TEACHER',p_valid_until:null,p_expected_version:1,p_request_id:randomUUID()},signal())).rejects.toMatchObject({code:'ACCESS_DENIED'});
  await expect(admin.controller.port.call('ws_s02_admin',{s:A},signal())).rejects.toMatchObject({code:'ACCESS_DENIED'});expect((await admin.controller.port.call('ws_s02_admin',{s:B},signal())as{requests:unknown[]}).requests).toHaveLength(0);
 });
 it('assistant cannot list admin records, change role, or propose administrator',async()=>{
  const x=createSchoolSession('electron',4);await x.controller.command('login');await x.controller.command('select',{school:A});
  for(const[name,args]of [['ws_s02_admin',{s:A}],['ws_v1_set_member_role',{p_school_id:A,p_membership_id:mid(3),p_new_role:'HEALTH_TEACHER',p_expected_version:1,p_request_id:randomUUID()}],['ws_v1_propose_admin_change',{p_school_id:A,p_target_membership_id:mid(3),p_mode:'add',p_request_id:randomUUID()}]]as const)await expect(x.controller.port.call(name,args,signal())).rejects.toMatchObject({code:'ACCESS_DENIED'});
 });
 it('role refresh, expiry mutation and live suspension/revocation all enforced',async()=>{
  const admin=createSchoolSession('electron',1),teacher=createSchoolSession('web',3),assistant=createSchoolSession('web',4);for(const x of[admin,teacher,assistant]){await x.controller.command('login');await x.controller.command('select',{school:A});}
  await admin.controller.command('role',{id:mid(4),role:'HEALTH_TEACHER',version:1});expect((await assistant.controller.command('refresh')).workspace.context?.role).toBe('HEALTH_TEACHER');
  await admin.controller.command('role',{id:mid(4),role:'HEALTH_ASSISTANT',version:2});await admin.controller.command('expiry',{id:mid(4),version:3,until:new Date(Date.now()+172800000).toISOString()});expect((await assistant.controller.command('refresh')).self.memberships[0].version).toBe(4);
  await admin.controller.command('membership',{id:mid(3),state:'suspended',version:1});expect((await teacher.controller.command('refresh')).workspace.phase).toBe('suspended');
  await admin.controller.command('membership',{id:mid(3),state:'revoked',version:2});expect((await teacher.controller.command('refresh')).self.memberships.find(m=>m.school_id===A)?.status).toBe('revoked');
 });
 it('expired assistant is denied and last admin leave/demotion/suspension is blocked',async()=>{
  await sql(`UPDATE workspace.school_memberships SET valid_until=statement_timestamp()-interval '1 second' WHERE id='${mid(4)}'`);const x=createSchoolSession('web',4);await x.controller.command('login');expect((await x.controller.command('select',{school:A})).workspace.phase).toBe('expired_membership');
  const a=createSchoolSession('electron',6);await a.controller.command('login');await a.controller.command('select',{school:B});for(const[action,args]of [['leave',{version:1}],['role',{id:mid(6),role:'HEALTH_TEACHER',version:1}],['membership',{id:mid(6),state:'suspended',version:1}]]as const)expect((await a.controller.command(action,args)).notice).toContain('권한');
  expect(await sql(`SELECT role FROM workspace.school_memberships WHERE id='${mid(6)}'`)).toBe('SCHOOL_ADMIN');
 });
 for(const mode of ['add','transfer'])it(`administrator ${mode}: recent reauth -> propose -> target accept -> server roles`,async()=>{
  const a=createSchoolSession('electron',1),t=createSchoolSession('web',3);for(const x of[a,t]){await x.controller.command('login');await x.controller.command('select',{school:A});}
  await sql("UPDATE auth.sessions SET created_at=statement_timestamp()-interval '20 minutes' WHERE user_id='00000000-0000-0000-0000-000000000001'");expect((await a.controller.command('propose',{id:mid(3),mode})).notice).toContain('다시 로그인');
  await a.controller.command('reauth');await a.controller.command('propose',{id:mid(3),mode});expect(await sql(`SELECT role FROM workspace.school_memberships WHERE id='${mid(3)}'`)).toBe('HEALTH_TEACHER');
  const inbox=await t.controller.command('refresh');expect(inbox.transfers[0].can_accept).toBe(true);
  expect((await a.controller.command('accept',{id:inbox.transfers[0].id,version:1})).notice).toContain('권한');
  await t.controller.command('reauth');expect((await t.controller.command('accept',{id:inbox.transfers[0].id,version:1})).workspace.context?.role).toBe('SCHOOL_ADMIN');
  expect(await sql(`SELECT role FROM workspace.school_memberships WHERE id='${mid(1)}'`)).toBe(mode==='add'?'SCHOOL_ADMIN':'HEALTH_TEACHER');
 });
 it('assistant cannot be proposed for admin and stale member versions do not partially update',async()=>{
  const a=createSchoolSession('web',1);await a.controller.command('login');await a.controller.command('select',{school:A});expect((await a.controller.command('propose',{id:mid(4),mode:'add'})).notice).toContain('권한');expect((await a.controller.command('role',{id:mid(3),role:'HEALTH_TEACHER',version:999})).notice).toContain('이미 처리');
 });
 it('late school A response cannot replace B; logout and expired session clear all school state',async()=>{
  const x=createSchoolSession('electron',3);await x.controller.command('login');const ready=deferred<void>(),done=deferred<void>(),call=x.controller.port.call;let once=true;
  x.controller.port.call=async(n,a,s)=>{const v=await call(n,a,s);if(once&&n==='ws_s02_self'){once=false;ready.resolve();await done.promise;}return v;};
  const old=x.controller.command('select',{school:A});await ready.promise;await x.controller.command('select',{school:B});done.resolve();await old;expect(x.controller.snapshot().selected).toBe(B);
  expect((await x.controller.command('logout')).self.memberships).toHaveLength(0);await x.controller.command('login');await x.controller.command('select',{school:A});await sql("UPDATE auth.sessions SET not_after=statement_timestamp()-interval '1 second' WHERE user_id='00000000-0000-0000-0000-000000000003'");const s=await x.controller.command('refresh');expect(s.workspace.phase).toBe('expired_session');expect(s.self.memberships).toHaveLength(0);expect(s.admin).toBeUndefined();
 });
 it('raw tables, audits, anon RPC and runtime/reader ownership remain protected',async()=>{
  for(const q of ["SELECT workspace_private.request_join('10000000-0000-0000-0000-000000000001','HEALTH_TEACHER',gen_random_uuid())",'SELECT * FROM workspace.s02_directory','SELECT * FROM workspace.school_memberships',"UPDATE workspace.audit_entries SET action='x'"]){await expect(sql(`BEGIN;SET LOCAL ROLE authenticated;${q};COMMIT;`,'school_client')).rejects.toThrow();}
  await expect(sql("SET ROLE anon;SELECT public.ws_s02_self()",'school_anon')).rejects.toThrow();
  expect(await sql("SELECT count(*) FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader') AND NOT rolbypassrls AND NOT rolcanlogin")).toBe('2');
 });
});
