import { describe,it,expect,vi } from 'vitest';
import { createHash } from 'node:crypto';
import { WorkspaceAuthError } from '../common/types.js';
import { WorkspaceRequestScope, WORKSPACE_RPC_NAMES } from '../common/rpc.js';
import { WebBffAuthAdapter, SESSION_COOKIE, FLOW_COOKIE } from '../web/bff-adapter.js';
import { CallbackFlows } from '../server/flow.js';
import { webSetup,request,readSetCookie,secret,deferred,MockSchool01aRpc,rpcContext,APP,AUTH,U1,U2,SCHOOL_A,SCHOOL_B } from './fixtures.js';
describe('Web BFF — MOCK Auth/store/RPC, REAL state/cookie/CSRF/concurrency logic',()=>{
 it('sets host-only Secure HttpOnly SameSite cookies with random opaque handles and no Auth tokens',async()=>{
  const x=webSetup(),login=await x.login();expect(login.handle).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const sessionCookie=login.result.setCookies.find(c=>c.startsWith(SESSION_COOKIE+'='))!;
  expect(sessionCookie).toContain('Path=/; HttpOnly; Secure; SameSite=Lax');expect(sessionCookie).not.toContain('Domain=');
  expect(JSON.stringify(login.result)).not.toMatch(/MOCK_ACCESS|MOCK_REFRESH|MOCK_CODE/);
  expect(await x.bff.status(login.req)).toEqual({kind:'authenticated',session:{user:{id:U1},expiresAt:x.provider.next.expiresAt}});
 });
 it('binds OAuth to the initiating browser cookie as well as state/flow',async()=>{
  const x=webSetup();const start=await x.bff.begin(request()),flow=readSetCookie(start.setCookies,FLOW_COOKIE),cb=x.provider.callback();
  await expect(x.bff.callback(cb,{})).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  await expect(x.bff.callback(cb,{[FLOW_COOKIE]:'x'.repeat(43)})).rejects.toMatchObject({code:'FLOW_MISMATCH'});
  const u=new URL(cb);u.searchParams.set('ws_state','wrong');await expect(x.bff.callback(u.href,{[FLOW_COOKIE]:flow})).rejects.toMatchObject({code:'FLOW_MISMATCH'});
  const a=await x.bff.callback(cb,{[FLOW_COOKIE]:flow});expect(a.status.kind).toBe('authenticated');
  await expect(x.bff.callback(cb,{[FLOW_COOKIE]:flow})).rejects.toMatchObject({code:'CALLBACK_REPLAY'});
 });
 it('rejects expired callback',async()=>{
  let now=Date.now();const x=webSetup(()=>now),s=await x.bff.begin(request()),flow=readSetCookie(s.setCookies,FLOW_COOKIE);now+=300001;
  await expect(x.bff.callback(x.provider.callback(),{[FLOW_COOKIE]:flow})).rejects.toMatchObject({code:'FLOW_EXPIRED'});
 });
 it('blocks cross-Origin, missing CSRF and non-POST requests before refresh',async()=>{
  const x=webSetup(),l=await x.login();
  await expect(x.bff.status({...l.req,origin:'https://evil.invalid'})).rejects.toMatchObject({code:'ORIGIN_REJECTED'});
  await expect(x.bff.status({...l.req,origin:null})).rejects.toMatchObject({code:'ORIGIN_REJECTED'});
  await expect(x.bff.status({...l.req,csrfToken:undefined})).rejects.toMatchObject({code:'CSRF_REJECTED'});
  await expect(x.bff.logout({...l.req,csrfToken:'wrong'})).rejects.toMatchObject({code:'CSRF_REJECTED'});
  await expect(x.bff.status({...l.req,method:'GET'})).rejects.toMatchObject({code:'CSRF_REJECTED'});
  expect(x.provider.refresh).not.toHaveBeenCalled();
 });
 it('refreshes once for simultaneous requests, including two adapter instances sharing the store',async()=>{
  const x=webSetup();x.provider.next=secret(U1,Date.now()+1000);const l=await x.login();
  const other=new WebBffAuthAdapter(x.provider,x.store,new CallbackFlows(APP+'/auth/callback'),APP,AUTH,'test');
  const started=deferred<void>(),finish=deferred<ReturnType<typeof secret>>();x.provider.refreshImpl=()=>{started.resolve();return finish.promise;};
  const p1=x.bff.status(l.req),p2=other.status(l.req),p3=x.bff.status(l.req);await started.promise;finish.resolve(secret());
  expect((await Promise.all([p1,p2,p3])).every(s=>s.kind==='authenticated')).toBe(true);expect(x.provider.refresh).toHaveBeenCalledOnce();
 });
 it('logout wins over an in-flight refresh without recreating the session',async()=>{
  const x=webSetup();x.provider.next=secret(U1,Date.now()+1000);const l=await x.login();
  const entered=deferred<void>(),d=deferred<ReturnType<typeof secret>>();x.provider.refreshImpl=()=>{entered.resolve();return d.promise;};
  const pending=x.bff.status(l.req);await entered.promise;await x.bff.logout(l.req);d.resolve(secret());
  await expect(pending).rejects.toMatchObject({code:'STALE_RESPONSE'});
  expect(await x.store.get(createHash('sha256').update(l.handle).digest('hex'))).toBeNull();
  await expect(x.bff.status(l.req)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
 it('a replacement login invalidates the old handle and uses same Auth UUID contract',async()=>{
  const x=webSetup(),l=await x.login();x.provider.next=secret(U2);
  const start=await x.bff.begin(l.req);await expect(x.bff.status(l.req)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
  const result=await x.bff.callback(x.provider.callback(),{[FLOW_COOKIE]:readSetCookie(start.setCookies,FLOW_COOKIE)});
  expect(JSON.stringify(result.status)).toContain(U2);expect(JSON.stringify(result.status)).not.toContain(U1);
 });
 it('logout cancels an unfinished OAuth exchange',async()=>{
  const x=webSetup(),start=await x.bff.begin(request()),flow=readSetCookie(start.setCookies,FLOW_COOKIE);
  const d=deferred<ReturnType<typeof secret>>();x.provider.exchangeImpl=()=>d.promise;
  const pending=x.bff.callback(x.provider.callback(),{[FLOW_COOKIE]:flow});await x.bff.logout(request({[FLOW_COOKIE]:flow}));d.resolve(secret());
  await expect(pending).rejects.toMatchObject({code:'STALE_RESPONSE'});
 });
 it('expires the BFF hard session, regardless of Auth refresh availability',async()=>{
  let now=Date.now();const x=webSetup(()=>now),l=await x.login();now+=43_200_001;
  await expect(x.bff.status(l.req)).rejects.toMatchObject({code:'UNAUTHENTICATED'});expect(x.provider.refresh).not.toHaveBeenCalled();
 });
 it('rejects identity changes on refresh and invalidates the session',async()=>{
  const x=webSetup();x.provider.next=secret(U1,Date.now()+1000);const l=await x.login();x.provider.refreshImpl=async()=>secret(U2);
  await expect(x.bff.status(l.req)).rejects.toMatchObject({code:'AUTH_SERVER_ERROR'});await expect(x.bff.status(l.req)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
 it('does not let a test memory store run in production mode',()=>{
  const x=webSetup();expect(()=>new WebBffAuthAdapter(x.provider,x.store,new CallbackFlows(APP+'/auth/callback'),APP,AUTH,'production')).toThrow('CONFIGURATION_ERROR');
 });
 it('pending membership blocks common Workspace access without locking the independent account',async()=>{
  const x=webSetup(),l=await x.login(),rpc=new MockSchool01aRpc();rpc.onCall=async()=>{throw new WorkspaceAuthError('ACCESS_DENIED');};
  await expect(x.bff.switchSchool(l.req,SCHOOL_A,()=>rpc)).rejects.toMatchObject({code:'ACCESS_DENIED'});
  const work=vi.fn(async()=> 'forbidden');await expect(x.bff.runWorkspace(l.req,work)).rejects.toMatchObject({code:'ACCESS_DENIED'});expect(work).not.toHaveBeenCalled();
  expect((await x.bff.forRequest(l.req).getStatus()).kind).toBe('authenticated');
 });
 it('rejects old school response after school switch across two BFF instances',async()=>{
  const x=webSetup(),l=await x.login(),other=new WebBffAuthAdapter(x.provider,x.store,new CallbackFlows(APP+'/auth/callback'),APP,AUTH,'test');
  const entered=deferred<void>(),d=deferred<unknown>(),old=new MockSchool01aRpc();old.onCall=()=>{entered.resolve();return d.promise;};
  const p=x.bff.switchSchool(l.req,SCHOOL_A,()=>old);await entered.promise;
  const fresh=new MockSchool01aRpc();fresh.context=rpcContext(SCHOOL_B);expect((await other.switchSchool(l.req,SCHOOL_B,()=>fresh)).schoolId).toBe(SCHOOL_B);
  d.resolve(rpcContext(SCHOOL_A));await expect(p).rejects.toMatchObject({code:'STALE_RESPONSE'});
  expect(await x.bff.runWorkspace(l.req,async(_token,_signal,school)=>school)).toBe(SCHOOL_B);
 });
 it('discards old business response after school switch or logout',async()=>{
  const x=webSetup(),l=await x.login(),rpc=new MockSchool01aRpc();await x.bff.switchSchool(l.req,SCHOOL_A,()=>rpc);
  const started=deferred<void>(),d=deferred<string>();const p=x.bff.runWorkspace(l.req,async()=>{started.resolve();return d.promise;});await started.promise;
  rpc.context=rpcContext(SCHOOL_B);await x.bff.switchSchool(l.req,SCHOOL_B,()=>rpc);d.resolve('old school data');await expect(p).rejects.toMatchObject({code:'STALE_RESPONSE'});
  const e=deferred<string>(),ready=deferred<void>();const p2=x.bff.runWorkspace(l.req,async()=>{ready.resolve();return e.promise;});await ready.promise;
  await x.bff.logout(l.req);e.resolve('old account data');await expect(p2).rejects.toMatchObject({code:'STALE_RESPONSE'});
 });
 it('permission denial clears approved-school context until server revalidation',async()=>{
  const x=webSetup(),l=await x.login();await x.bff.switchSchool(l.req,SCHOOL_A,()=>new MockSchool01aRpc());
  await expect(x.bff.runWorkspace(l.req,async()=>{throw new WorkspaceAuthError('ACCESS_DENIED');})).rejects.toMatchObject({code:'ACCESS_DENIED'});
  await expect(x.bff.runWorkspace(l.req,async()=> 'blocked')).rejects.toMatchObject({code:'ACCESS_DENIED'});
 });
 it('remote logout failure is explicitly unconfirmed after local deletion',async()=>{
  const x=webSetup(),l=await x.login();x.provider.revoke.mockRejectedValueOnce(Error('MOCK_REFRESH_PRIVATE'));
  const reply=await x.bff.logout(l.req);expect(reply.remoteRevocation).toBe('unconfirmed');expect(reply.setCookies.every(c=>c.includes('Max-Age=0'))).toBe(true);
  await expect(x.bff.status(l.req)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });
});
// A failed old request is stale too, even across BFF instances sharing the session store.
it('late cross-instance school denial cannot override the newer school selection',async()=>{
 const x=webSetup(),l=await x.login(),other=new WebBffAuthAdapter(x.provider,x.store,new CallbackFlows(APP+'/auth/callback'),APP,AUTH,'test');
 const entered=deferred<void>(),d=deferred<unknown>(),old=new MockSchool01aRpc();old.onCall=()=>{entered.resolve();return d.promise;};
 const p=x.bff.switchSchool(l.req,SCHOOL_A,()=>old);await entered.promise;
 const newer=new MockSchool01aRpc();newer.context=rpcContext(SCHOOL_B);await other.switchSchool(l.req,SCHOOL_B,()=>newer);
 d.reject(new WorkspaceAuthError('ACCESS_DENIED'));await expect(p).rejects.toMatchObject({code:'STALE_RESPONSE'});
 expect(await x.bff.runWorkspace(l.req,async(_t,_s,school)=>school)).toBe(SCHOOL_B);
});

describe('common DTO/RPC contract and response generation — MOCK server responses',()=>{
 it('lists the seven SCHOOL-01A RPC names exactly',()=>{expect(WORKSPACE_RPC_NAMES).toHaveLength(7);expect(WORKSPACE_RPC_NAMES).toContain('ws_v1_bootstrap');expect(WORKSPACE_RPC_NAMES).toContain('ws_v1_leave_school');});
 it('rejects PENDING/non-role/mismatched school context from a transport',async()=>{
  const scope=new WorkspaceRequestScope(),rpc=new MockSchool01aRpc();
  rpc.onCall=async()=>({...rpcContext(),role:'PENDING'});await expect(scope.switchSchool(rpc,SCHOOL_A)).rejects.toMatchObject({code:'ACCESS_DENIED'});expect(scope.context).toBeNull();
  rpc.onCall=async()=>rpcContext(SCHOOL_B);await expect(scope.switchSchool(rpc,SCHOOL_A)).rejects.toMatchObject({code:'ACCESS_DENIED'});
 });
 it('cancels the old request and rejects late success, even when transport ignores AbortSignal',async()=>{
  const scope=new WorkspaceRequestScope(),old=new MockSchool01aRpc(),d=deferred<unknown>();let signal:AbortSignal|undefined;
  old.onCall=async(_n,_a,s)=>{signal=s;return d.promise;};const p=scope.switchSchool(old,SCHOOL_A);
  const fresh=new MockSchool01aRpc();fresh.context=rpcContext(SCHOOL_B);await scope.switchSchool(fresh,SCHOOL_B);
  expect(signal?.aborted).toBe(true);d.resolve(rpcContext(SCHOOL_A));await expect(p).rejects.toMatchObject({code:'STALE_RESPONSE'});expect(scope.context?.schoolId).toBe(SCHOOL_B);
 });
 it('late old failure cannot erase a newer school context',async()=>{
  const scope=new WorkspaceRequestScope(),rpc=new MockSchool01aRpc(),d=deferred<unknown>();rpc.onCall=()=>d.promise;
  const p=scope.switchSchool(rpc,SCHOOL_A);const newer=new MockSchool01aRpc();newer.context=rpcContext(SCHOOL_B);await scope.switchSchool(newer,SCHOOL_B);
  d.reject(new WorkspaceAuthError('ACCESS_DENIED'));await expect(p).rejects.toMatchObject({code:'STALE_RESPONSE'});expect(scope.context?.schoolId).toBe(SCHOOL_B);
 });
});

it('BFF provider cancellation disposes the private pending flow',async()=>{
 const x=webSetup(),start=await x.bff.begin(request()),flow=readSetCookie(start.setCookies,FLOW_COOKIE),u=new URL(x.provider.callback());
 u.searchParams.delete('code');u.searchParams.set('error','access_denied');await expect(x.bff.callback(u.href,{[FLOW_COOKIE]:flow})).rejects.toMatchObject({code:'AUTH_CANCELLED'});
 expect(x.provider.exchange).not.toHaveBeenCalled();expect(x.provider.forget).toHaveBeenCalled();
 await expect(x.bff.callback(u.href,{[FLOW_COOKIE]:flow})).rejects.toMatchObject({code:'FLOW_MISMATCH'});
});
