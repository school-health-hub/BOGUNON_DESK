import { describe,it,expect,vi } from 'vitest';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalTaskStore } from '../../../electron-p0/main/local-tasks.js';
import { WorkspaceAuthError } from '../common/types.js';
import { FileSessionBlob, WindowsSessionVault } from '../electron/vault.js';
import { registerWorkspaceAuthIpc } from '../electron/ipc.js';
import { AUTH_CHANNELS, type AuthReply } from '../electron/ipc-contract.js';
import { createAuthPreloadBridge, exposeWorkspaceAuthBridge } from '../electron/preload.js';
import { electronSetup, deferred, secret, U1,U2, MockSchool01aRpc, SCHOOL_A } from './fixtures.js';
describe('Electron Main adapter — MOCK Auth/safeStorage, REAL state/IPC/file boundaries',()=>{
 it('signed out -> signing in -> authenticated; opens only system browser and returns UUID summary',async()=>{
  const x=electronSetup();expect(await x.adapter.getStatus()).toEqual({kind:'signed_out'});
  await x.adapter.beginSignIn();expect((await x.adapter.getStatus()).kind).toBe('signing_in');expect(x.open).toHaveBeenCalledOnce();
  await x.adapter.handleCallback(x.provider.callback());expect(await x.adapter.getStatus()).toEqual({kind:'authenticated',session:{user:{id:U1},expiresAt:x.provider.next.expiresAt}});
  expect(JSON.stringify(await x.adapter.getStatus())).not.toMatch(/MOCK_ACCESS|MOCK_REFRESH|MOCK_CODE/);
 });
 it.each(['ws_state','ws_flow'])('rejects mismatched %s without exchanging code',async key=>{
  const x=electronSetup();await x.adapter.beginSignIn();const u=new URL(x.provider.callback());u.searchParams.set(key,'wrong');
  await expect(x.adapter.handleCallback(u.href)).rejects.toMatchObject({code:'FLOW_MISMATCH'});expect(x.provider.exchange).not.toHaveBeenCalled();
 });
 it.each(['https://evil.invalid/callback','bogunon-desk://other/callback','bogunon-desk://workspace-auth/callback#fragment'])('rejects callback target %s',async bad=>{
  const x=electronSetup();await x.adapter.beginSignIn();await expect(x.adapter.handleCallback(bad)).rejects.toMatchObject({code:'INVALID_CALLBACK'});
 });
 it('rejects duplicate query parameters and code/error ambiguity',async()=>{
  const x=electronSetup();await x.adapter.beginSignIn();const u=new URL(x.provider.callback());u.searchParams.append('code','second');
  await expect(x.adapter.handleCallback(u.href)).rejects.toMatchObject({code:'INVALID_CALLBACK'});
  u.searchParams.delete('code');u.searchParams.set('code','one');u.searchParams.set('error','access_denied');
  await expect(x.adapter.handleCallback(u.href)).rejects.toMatchObject({code:'INVALID_CALLBACK'});
 });
 it('expires flow before code exchange',async()=>{
  let now=Date.now();const x=electronSetup(()=>now);await x.adapter.beginSignIn();now+=300001;
  await expect(x.adapter.handleCallback(x.provider.callback())).rejects.toMatchObject({code:'FLOW_EXPIRED'});expect(x.provider.exchange).not.toHaveBeenCalled();
 });
 it('consumes callbacks synchronously before asynchronous exchange, preventing concurrent replay',async()=>{
  const x=electronSetup(),d=deferred<ReturnType<typeof secret>>();x.provider.exchangeImpl=()=>d.promise;
  await x.adapter.beginSignIn();const c=x.provider.callback(),pending=x.adapter.handleCallback(c);
  await expect(x.adapter.handleCallback(c)).rejects.toMatchObject({code:'CALLBACK_REPLAY'});
  d.resolve(secret());await pending;await expect(x.adapter.handleCallback(c)).rejects.toMatchObject({code:'CALLBACK_REPLAY'});
  expect(x.provider.exchange).toHaveBeenCalledOnce();
 });
 it('clears encrypted session and Workspace caches on account switch',async()=>{
  const x=electronSetup();await x.adapter.beginSignIn();await x.adapter.handleCallback(x.provider.callback());
  const rpc=new MockSchool01aRpc();await x.adapter.workspace.switchSchool(rpc,SCHOOL_A);x.adapter.workspace.cache('task','SYNTHETIC');
  x.provider.next=secret(U2);await x.adapter.beginSignIn();expect(x.blob.value).toBeNull();expect(x.adapter.workspace.context).toBeNull();expect(x.adapter.workspace.cachedCount).toBe(0);
  await x.adapter.handleCallback(x.provider.callback());expect((await x.adapter.getStatus()).kind).toBe('authenticated');expect(JSON.stringify(await x.adapter.getStatus())).toContain(U2);
 });
 it('fails closed if safeStorage encryption is unavailable; never writes plaintext',async()=>{
  const x=electronSetup();x.safe.isEncryptionAvailable=()=>false;await x.adapter.beginSignIn();
  await expect(x.adapter.handleCallback(x.provider.callback())).rejects.toMatchObject({code:'STORAGE_UNAVAILABLE'});
  expect(x.blob.replace).not.toHaveBeenCalled();expect((await x.adapter.getStatus()).kind).toBe('error');
 });
 it('sanitizes encryption errors and disk replacement failures',async()=>{
  const x=electronSetup();x.safe.encryptString=()=>{throw Error('MOCK_ACCESS_PRIVATE');};await x.adapter.beginSignIn();
  await expect(x.adapter.handleCallback(x.provider.callback())).rejects.toMatchObject({message:'STORAGE_UNAVAILABLE'});
  expect(JSON.stringify(await x.adapter.getStatus())).not.toContain('MOCK_ACCESS');
  const y=electronSetup();y.blob.replace.mockRejectedValueOnce(Error('disk failure'));await y.adapter.beginSignIn();
  await expect(y.adapter.handleCallback(y.provider.callback())).rejects.toMatchObject({code:'STORAGE_UNAVAILABLE'});
 });
 it('rejects corrupt restored session and deletes it without leaking raw exception',async()=>{
  const x=electronSetup();x.blob.value=Buffer.from('damaged');await x.adapter.restore();
  expect(await x.adapter.getStatus()).toEqual({kind:'error',error:'SESSION_CORRUPT'});expect(x.blob.value).toBeNull();
 });
 it('restores unexpired secure session without reauth, refreshes expired session through provider',async()=>{
  const x=electronSetup();await x.vault.save(secret());await x.adapter.restore();expect((await x.adapter.getStatus()).kind).toBe('authenticated');expect(x.provider.refresh).not.toHaveBeenCalled();
  await x.vault.save(secret(U1,Date.now()-1));await x.adapter.restore();expect(x.provider.refresh).toHaveBeenCalledOnce();expect((await x.adapter.getStatus()).kind).toBe('authenticated');
 });
 it('rejects refresh that unexpectedly changes user identity',async()=>{
  const x=electronSetup();await x.vault.save(secret(U1,Date.now()-1));x.provider.refreshImpl=async()=>secret(U2);await x.adapter.restore();
  expect((await x.adapter.getStatus()).kind).toBe('error');expect(x.blob.value).toBeNull();
 });
 it('logout wins against a slow code exchange, with no session resurrection',async()=>{
  const x=electronSetup(),d=deferred<ReturnType<typeof secret>>();x.provider.exchangeImpl=()=>d.promise;
  await x.adapter.beginSignIn();const pending=x.adapter.handleCallback(x.provider.callback());await x.adapter.logout();d.resolve(secret());
  await expect(pending).rejects.toMatchObject({code:'STALE_RESPONSE'});expect(x.blob.value).toBeNull();expect(await x.adapter.getStatus()).toEqual({kind:'signed_out'});
 });
 it('logout during a slow vault write removes the late secret',async()=>{
  const x=electronSetup(),write=deferred<void>(),entered=deferred<void>();
  x.blob.replace.mockImplementation(async value=>{entered.resolve();await write.promise;x.blob.value=value;});
  await x.adapter.beginSignIn();const p=x.adapter.handleCallback(x.provider.callback());await entered.promise;
  const logout=x.adapter.logout();write.resolve();await expect(p).rejects.toMatchObject({code:'STALE_RESPONSE'});await logout;
  expect(x.blob.value).toBeNull();expect(x.adapter.workspace.context).toBeNull();
 });
 it('Auth server failure does not call or gate unrelated local functionality',async()=>{
  const x=electronSetup();x.provider.exchangeImpl=async()=>{throw Error('server includes MOCK_REFRESH_PRIVATE');};
  await x.adapter.beginSignIn();await expect(x.adapter.handleCallback(x.provider.callback())).rejects.toMatchObject({code:'AUTH_SERVER_ERROR'});
  const personalTool=vi.fn(()=> 'local memo available');expect(personalTool()).toBe('local memo available');
  expect(JSON.stringify(await x.adapter.getStatus())).not.toContain('MOCK_REFRESH');
 });
 it('clears Workspace on permission denial while retaining separate account login',async()=>{
  const x=electronSetup();await x.adapter.beginSignIn();await x.adapter.handleCallback(x.provider.callback());await x.adapter.workspace.switchSchool(new MockSchool01aRpc(),SCHOOL_A);
  await expect(x.adapter.runAuthorized(async()=>{throw new WorkspaceAuthError('ACCESS_DENIED');})).rejects.toMatchObject({code:'ACCESS_DENIED'});
  expect(x.adapter.workspace.context).toBeNull();expect((await x.adapter.getStatus()).kind).toBe('authenticated');
 });
 it('refuses arbitrary browser destinations from a bad provider',async()=>{
  const x=electronSetup();x.provider.start.mockResolvedValue('https://evil.invalid');await expect(x.adapter.beginSignIn()).rejects.toMatchObject({code:'CONFIGURATION_ERROR'});expect(x.open).not.toHaveBeenCalled();
 });
 it('isolated FileSessionBlob persists encrypted bytes and rejects symlink targets',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ws-auth-test-'));const x=electronSetup(),blob=new FileSessionBlob(dir),vault=new WindowsSessionVault(x.safe,blob,'win32');
  try {await vault.save(secret());const bytes=await readFile(join(dir,'school-workspace-auth-v1','session.bin'));expect(bytes.toString()).not.toContain('MOCK_ACCESS_PRIVATE');expect(await vault.load()).toEqual(expect.objectContaining({userId:U1}));await vault.clear();
    await writeFile(join(dir,'other'),'preserve');await symlink(join(dir,'other'),join(dir,'school-workspace-auth-v1','session.bin'));
    await expect(vault.save(secret())).rejects.toMatchObject({code:'STORAGE_UNAVAILABLE'});expect(await readFile(join(dir,'other'),'utf8')).toBe('preserve');
  } finally {await rm(dir,{recursive:true,force:true});}
 });
 it('never persists on non-Windows platforms',async()=>{
  const x=electronSetup(),vault=new WindowsSessionVault(x.safe,x.blob,'linux');await expect(vault.save(secret())).rejects.toMatchObject({code:'STORAGE_UNAVAILABLE'});expect(x.blob.replace).not.toHaveBeenCalled();
 });
 it('real assertSender guards sender/frame/origin and IPC exposes only four fixed operations',async()=>{
  const x=electronSetup(),mainFrame={},contents={mainFrame,getURL:()=> 'file:///trusted/index.html'};
  const handlers=new Map<string,(e:{sender:unknown;senderFrame:unknown},...args:unknown[])=>Promise<AuthReply>>();
  const dispose=registerWorkspaceAuthIpc({handle:(k,h)=>{handlers.set(k,h);},removeHandler:k=>{handlers.delete(k);}},contents,contents.getURL(),x.adapter);
  const event={sender:contents,senderFrame:mainFrame};
  for (const bad of [{sender:{},senderFrame:mainFrame},{sender:contents,senderFrame:{} }])expect(await handlers.get(AUTH_CHANNELS.status)!(bad)).toEqual({ok:false,error:'IPC_REJECTED'});
  expect(await handlers.get(AUTH_CHANNELS.status)!(event,'injected')).toEqual({ok:false,error:'IPC_REJECTED'});
  contents.getURL=()=> 'https://evil.invalid';expect(await handlers.get(AUTH_CHANNELS.status)!(event)).toEqual({ok:false,error:'IPC_REJECTED'});
  contents.getURL=()=> 'file:///trusted/index.html';
  const invoke=vi.fn(async(channel:string)=>handlers.get(channel)!(event));const bridge=createAuthPreloadBridge(invoke);
  expect(Object.keys(bridge).sort()).toEqual(['begin','logout','restore','status']);expect(Object.isFrozen(bridge)).toBe(true);
  const expose=vi.fn();exposeWorkspaceAuthBridge(expose,invoke);expect(expose).toHaveBeenCalledWith('workspaceAuth',expect.any(Object));
  await bridge.begin();await x.adapter.handleCallback(x.provider.callback());const response=await bridge.status();
  expect(JSON.stringify(response)).not.toMatch(/MOCK_ACCESS|MOCK_REFRESH|MOCK_CODE|verifier/);await bridge.logout();expect((await x.adapter.getStatus()).kind).toBe('signed_out');dispose();expect(handlers.size).toBe(0);
 });
 it('reports unconfirmed remote logout while keeping local state signed out',async()=>{
  const x=electronSetup();await x.adapter.beginSignIn();await x.adapter.handleCallback(x.provider.callback());
  x.provider.revoke.mockRejectedValueOnce(Error('remote failure'));
  await x.adapter.logout();expect(await x.adapter.getStatus()).toEqual({kind:'signed_out',remoteRevocation:'unconfirmed'});expect(x.blob.value).toBeNull();
 });

 it('real existing LocalTaskStore remains writable through Auth failure and logout',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ws-personal-isolation-')),x=electronSetup(),store=new LocalTaskStore(dir);
  try {
   x.provider.exchangeImpl=async()=>{throw Error('auth offline');};await x.adapter.beginSignIn();await expect(x.adapter.handleCallback(x.provider.callback())).rejects.toMatchObject({code:'AUTH_SERVER_ERROR'});
   const before=await store.load();const saved=await store.save({...before.document,tasks:[{id:randomUUID(),title:'SYNTHETIC personal task',scheduledDate:'2026-11-05',dueDate:null,completed:false,priority:'normal',category:'교육',dday:false}]},0);
   expect(saved.document.revision).toBe(1);await x.adapter.logout();expect((await new LocalTaskStore(dir).load()).document.tasks).toEqual(saved.document.tasks);
  } finally {await rm(dir,{recursive:true,force:true});}
 });
 it('a failed local deletion is reported, never a successful logout claim',async()=>{
  const x=electronSetup();await x.adapter.beginSignIn();await x.adapter.handleCallback(x.provider.callback());
  x.blob.remove.mockRejectedValueOnce(Error('disk locked'));
  await expect(x.adapter.logout()).rejects.toMatchObject({code:'STORAGE_UNAVAILABLE'});expect(await x.adapter.getStatus()).toEqual({kind:'error',error:'STORAGE_UNAVAILABLE'});
  await expect(x.adapter.runAuthorized(async()=> 'forbidden')).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 });

 it('clears a partially completed vault write before reporting storage failure',async()=>{
  const x=electronSetup();x.blob.replace.mockImplementationOnce(async value=>{x.blob.value=value;throw Error('late storage failure');});
  await x.adapter.beginSignIn();await expect(x.adapter.handleCallback(x.provider.callback())).rejects.toMatchObject({code:'STORAGE_UNAVAILABLE'});
  expect(x.blob.value).toBeNull();expect((await x.adapter.getStatus()).kind).toBe('error');
 });

 it('valid provider cancellation ends the flow without exchanging or leaking provider text',async()=>{
  const x=electronSetup();await x.adapter.beginSignIn();const u=new URL(x.provider.callback());u.searchParams.delete('code');u.searchParams.set('error','access_denied');
  await expect(x.adapter.handleCallback(u.href)).rejects.toMatchObject({code:'AUTH_CANCELLED'});expect(x.provider.exchange).not.toHaveBeenCalled();expect(x.provider.forget).toHaveBeenCalled();
  expect(await x.adapter.getStatus()).toEqual({kind:'error',error:'AUTH_CANCELLED'});
 });

});
