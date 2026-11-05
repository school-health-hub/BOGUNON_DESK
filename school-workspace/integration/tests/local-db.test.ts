import{beforeEach,describe,it,expect}from'vitest';
import{randomUUID}from'node:crypto';
import{mkdtemp,rm}from'node:fs/promises';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{LocalTaskStore}from'../../../electron-p0/main/local-tasks.js';
import{WorkspaceAuthError}from'../../auth/common/types.js';
import{deferred}from'../../auth/tests/fixtures.js';
import{createDevPreloadBridge,registerDevWorkspaceIpc,type DevIpc}from'../server/dev-ipc.js';
import{localSql}from'../server/local-db.js';
import{A,B,member,user,electronRig,webRig,resetDatabase}from'./rig.js';
describe('LOCAL DB RPC/RLS + MOCK AUTH/STORAGE — no REAL HOSTED',()=>{
 beforeEach(resetDatabase);
 for(const platform of ['electron','web']as const){
  it(`${platform}: login -> real bootstrap -> school selection with server effective permissions`,async()=>{
   const x=platform==='electron'?electronRig():webRig();await x.controller.login();expect(x.controller.snapshot().phase).toBe('authenticated_unselected');
   expect(await localSql("SELECT count(*) FROM workspace.audit_entries WHERE action='bootstrap'")).toBe('1');
   await x.controller.selectSchool(A);expect(x.controller.snapshot()).toMatchObject({phase:'approved',context:{schoolId:A,role:'HEALTH_TEACHER',permissions:expect.arrayContaining(['task.read','handover.create'])}});
   const result=await x.controller.request('ws_v1_get_context',{p_school_id:A});expect(result.role).toBe('HEALTH_TEACHER');
  });
  it(`${platform}: pending membership has no shared context and actual RPC is denied`,async()=>{
   const x=platform==='electron'?electronRig(5):webRig(5);await x.controller.login();await x.controller.selectSchool(A);expect(x.controller.snapshot()).toMatchObject({phase:'pending',schoolId:A});expect(x.controller.snapshot().context).toBeUndefined();
   await expect(x.port.rpc('ws_v1_get_context',{p_school_id:A},new AbortController().signal)).rejects.toMatchObject({code:'ACCESS_DENIED'});
   const token=x.registry.issue(user(5),'30000000-0000-0000-0000-000000000005').accessToken;
   await expect(x.transport.invoke(token,'ws_v1_get_context',{p_school_id:A},new AbortController().signal)).rejects.toMatchObject({code:'ACCESS_DENIED'});
   await expect(x.controller.request('ws_v1_get_context',{p_school_id:A})).rejects.toMatchObject({code:'ACCESS_DENIED'});
  });
  it(`${platform}: assistant management attempt reaches the real server and is rejected`,async()=>{
   const x=platform==='electron'?electronRig(4):webRig(4);await x.controller.login();await x.controller.selectSchool(A);expect(x.controller.snapshot().context?.role).toBe('HEALTH_ASSISTANT');
   await expect(x.controller.request('ws_v1_set_member_role',{p_school_id:A,p_membership_id:member(3),p_new_role:'HEALTH_TEACHER',p_expected_version:1,p_request_id:randomUUID()})).rejects.toMatchObject({code:'ACCESS_DENIED'});
   expect(await localSql(`SELECT version FROM workspace.school_memberships WHERE id='${member(3)}'`)).toBe('1');
  });
  it(`${platform}: unauthorized other-school context is denied in status and real get_context`,async()=>{
   const x=platform==='electron'?electronRig(4):webRig(4);await x.controller.login();await x.controller.selectSchool(B);expect(x.controller.snapshot().phase).toBe('access_denied');
   await expect(x.port.rpc('ws_v1_get_context',{p_school_id:B},new AbortController().signal)).rejects.toMatchObject({code:'ACCESS_DENIED'});
   const token=x.registry.issue(user(4),'30000000-0000-0000-0000-000000000004').accessToken;
   await expect(x.transport.invoke(token,'ws_v1_get_context',{p_school_id:B},new AbortController().signal)).rejects.toMatchObject({code:'ACCESS_DENIED'});
  });
  it(`${platform}: same user switches A teacher -> B assistant using server roles`,async()=>{
   const x=platform==='electron'?electronRig():webRig();await x.controller.login();await x.controller.selectSchool(A);expect(x.controller.snapshot().context?.role).toBe('HEALTH_TEACHER');
   await x.controller.selectSchool(B);expect(x.controller.snapshot().context?.role).toBe('HEALTH_ASSISTANT');expect(x.controller.snapshot().context?.permissions).toContain('task.change_status');expect(x.controller.snapshot().context?.permissions).not.toContain('handover.create');
  });
  it(`${platform}: membership suspension rejects old session on server and client projection`,async()=>{
   const target=platform==='electron'?electronRig():webRig(),admin=electronRig(1);await target.controller.login();await target.controller.selectSchool(A);await admin.controller.login();await admin.controller.selectSchool(A);
   await admin.controller.request('ws_v1_set_membership_state',{p_school_id:A,p_membership_id:member(3),p_state:'suspended',p_expected_version:1,p_request_id:randomUUID()});
   await expect(target.port.rpc('ws_v1_get_context',{p_school_id:A},new AbortController().signal)).rejects.toMatchObject({code:'ACCESS_DENIED'});
   await expect(target.controller.request('ws_v1_get_context',{p_school_id:A})).rejects.toMatchObject({kind:'suspended'});expect(target.controller.snapshot().phase).toBe('suspended');
  });
  it(`${platform}: version conflict is real SQL conflict with no partial update`,async()=>{
   const x=platform==='electron'?electronRig(1):webRig(1);await x.controller.login();await x.controller.selectSchool(A);
   await expect(x.controller.request('ws_v1_set_member_role',{p_school_id:A,p_membership_id:member(3),p_new_role:'HEALTH_TEACHER',p_expected_version:999,p_request_id:randomUUID()})).rejects.toMatchObject({kind:'conflict'});
   expect(x.controller.snapshot().phase).toBe('conflict');expect(await localSql(`SELECT version FROM workspace.school_memberships WHERE id='${member(3)}'`)).toBe('1');
  });
 }
 it('real delayed A response is discarded after B selection, including transport ignoring abort',async()=>{
  const x=electronRig(),ready=deferred<void>(),finish=deferred<void>(),invoke=x.transport.invoke.bind(x.transport);let slow=true;
  x.transport.invoke=async(t,n,args,signal)=>{const v=await invoke(t,n,args,signal);if(slow&&n==='ws_v1_get_context'&&(args as{p_school_id:string}).p_school_id===A){slow=false;ready.resolve();await finish.promise;}return v;};
  await x.controller.login();const old=x.controller.selectSchool(A);await ready.promise;await x.controller.selectSchool(B);finish.resolve();await old;expect(x.controller.snapshot()).toMatchObject({phase:'approved',schoolId:B});
 });
 it('account change discards old DB response and clears Main Workspace cache',async()=>{
  const x=electronRig(),ready=deferred<void>(),finish=deferred<void>(),invoke=x.transport.invoke.bind(x.transport);let slow=true;
  x.transport.invoke=async(t,n,args,s)=>{const v=await invoke(t,n,args,s);if(slow&&n==='ws_v1_get_context'){slow=false;ready.resolve();await finish.promise;}return v;};
  await x.controller.login();const old=x.controller.selectSchool(A);await ready.promise;x.provider.userId=user(1);x.provider.sessionId='30000000-0000-0000-0000-000000000001';await x.controller.login();finish.resolve();await old;
  expect(x.controller.snapshot().phase).toBe('authenticated_unselected');expect(x.auth.workspace.context).toBeNull();expect(x.auth.workspace.cachedCount).toBe(0);
 });
 it('admin demotion prevents management despite previously cached admin role',async()=>{
  const x=electronRig(1),other=electronRig(2);for(const r of[x,other]){await r.controller.login();await r.controller.selectSchool(A);}
  await other.controller.request('ws_v1_set_member_role',{p_school_id:A,p_membership_id:member(1),p_new_role:'HEALTH_TEACHER',p_expected_version:1,p_request_id:randomUUID()});
  await expect(x.controller.request('ws_v1_set_membership_state',{p_school_id:A,p_membership_id:member(3),p_state:'suspended',p_expected_version:1,p_request_id:randomUUID()})).rejects.toMatchObject({code:'ACCESS_DENIED'});
  await x.controller.selectSchool(A);expect(x.controller.snapshot().context?.role).toBe('HEALTH_TEACHER');
 });
 it('membership expiry and recovery lock are distinct real server states',async()=>{
  const x=electronRig(8);await x.controller.login();await x.controller.selectSchool(A);expect(x.controller.snapshot().phase).toBe('expired_membership');
  await localSql(`UPDATE workspace.schools SET state='recovery_locked' WHERE id='${A}'`);const y=electronRig();await y.controller.login();await y.controller.selectSchool(A);expect(y.controller.snapshot().phase).toBe('recovery_locked');
 });
 it('expired real auth.sessions row locks shared operations despite a previously accepted mock JWT',async()=>{
  const x=electronRig();await x.controller.login();await x.controller.selectSchool(A);await localSql("UPDATE auth.sessions SET not_after=statement_timestamp()-interval '1 second' WHERE user_id='00000000-0000-0000-0000-000000000003'");
  await expect(x.controller.request('ws_v1_get_context',{p_school_id:A})).rejects.toMatchObject({code:'UNAUTHENTICATED'});expect(x.controller.snapshot().phase).toBe('expired_session');
 });
 it('logout clears view and rejects new operations with old synthetic session',async()=>{
  const x=electronRig();await x.controller.login();await x.controller.selectSchool(A);await x.controller.logout();expect(x.controller.snapshot()).toEqual({phase:'signed_out'});expect(x.blob.value).toBeNull();
  await expect(x.controller.request('ws_v1_get_context',{p_school_id:A})).rejects.toMatchObject({code:'ACCESS_DENIED'});
 });
 it('encryption failure never writes plaintext or bootstraps, Renderer DTO contains no tokens',async()=>{
  const x=electronRig();x.safe.isEncryptionAvailable=()=>false;await x.controller.login();expect(x.blob.value).toBeNull();expect(x.transport.calls).toBe(0);
  expect(JSON.stringify(x.controller.snapshot())).not.toMatch(/SCHOOL01C_MOCK|refreshToken|accessToken|verifier/);
 });
 it('network error leaves real existing personal store writable and unaffiliated with Auth',async()=>{
  const x=electronRig();await x.controller.login();await x.controller.selectSchool(A);x.transport.offline=true;await expect(x.controller.request('ws_v1_get_context',{p_school_id:A})).rejects.toMatchObject({kind:'network_error'});expect(x.controller.snapshot().phase).toBe('network_error');
  const dir=await mkdtemp(join(tmpdir(),'school01c-personal-'));try{const store=new LocalTaskStore(dir);const before=await store.load();const saved=await store.save(before.document,0);expect(saved.document.revision).toBe(1);expect((await store.load()).document.revision).toBe(1);}finally{await rm(dir,{recursive:true,force:true});}
 });
 it('forged synthetic token claims are rejected by the local registry before any SQL',async()=>{
  const x=electronRig();await expect(x.transport.invoke('SCHOOL01C_MOCK.forged.signature','ws_v1_bootstrap',{},new AbortController().signal)).rejects.toBeInstanceOf(WorkspaceAuthError);
 });
 it('Web Origin and CSRF rejection precedes the actual DB bootstrap transport',async()=>{
  const x=webRig();await x.controller.login();const calls=x.transport.calls,req=x.getRequest();
  await expect(x.bff.runAccountRequest({...req,origin:'https://attacker.invalid'},()=>Promise.resolve('never'))).rejects.toMatchObject({code:'ORIGIN_REJECTED'});
  await expect(x.bff.runAccountRequest({...req,csrfToken:'wrong'},()=>Promise.resolve('never'))).rejects.toMatchObject({code:'CSRF_REJECTED'});
  expect(x.transport.calls).toBe(calls);
 });
 it('Web concurrent refresh serializes before two real DB membership lookups',async()=>{
  const x=webRig();await x.controller.login();
  const {createHash}=await import('node:crypto'),handle=x.getRequest().cookies['__Host-ws_session']!;
  const key=createHash('sha256').update(handle).digest('hex'),record=(await x.store.get(key))!;
  await x.store.compareAndSwap(key,record.revision,{...record,revision:record.revision+1,secret:{...record.secret,expiresAt:Date.now()+1000}});
  const result=await Promise.all([x.port.membership(A,new AbortController().signal),x.port.membership(B,new AbortController().signal)]);
  expect(result.every(r=>r.status==='active')).toBe(true);expect(x.provider.refreshes).toBe(1);
 });

 it('Main -> dedicated IPC -> real DB returns token-free context and rejects foreign frames',async()=>{
  const x=electronRig(),handlers=new Map<string,Parameters<DevIpc['handle']>[1]>();
  const ipc:DevIpc={handle:(k,fn)=>{handlers.set(k,fn);},removeHandler:k=>{handlers.delete(k);}},contents={mainFrame:{},getURL:()=> 'http://127.0.0.1:5174/'};
  const event={sender:contents,senderFrame:contents.mainFrame};
  expect(()=>registerDevWorkspaceIpc(ipc,contents,contents.getURL(),x.controller,false)).toThrow();
  const dispose=registerDevWorkspaceIpc(ipc,contents,contents.getURL(),x.controller,true);
  const bridge=createDevPreloadBridge((channel,command,...args)=>handlers.get(channel)!(event,command,...args));
  expect(Object.isFrozen(bridge)).toBe(true);await bridge.login();const result=await bridge.selectSchool(A);
  expect(result).toMatchObject({ok:true,state:{phase:'approved'}});expect(JSON.stringify(result)).not.toMatch(/SCHOOL01C_MOCK|accessToken|refreshToken|verifier/);
  expect(await handlers.values().next().value!({sender:{},senderFrame:{}},'state')).toMatchObject({ok:false});
  expect(await handlers.values().next().value!({...event,senderFrame:{}},'state')).toMatchObject({ok:false});
  expect(await handlers.values().next().value!(event,'sql','SELECT')).toMatchObject({ok:false});
  await bridge.logout();dispose();expect(handlers.size).toBe(0);
 });

});
