import { vi } from 'vitest';
import { WorkspaceAuthError } from '../common/types.js';
import type { IdentityProvider, SecretSession } from '../server/ports.js';
import { CallbackFlows } from '../server/flow.js';
import { WindowsSessionVault, type CipherBlobPort, type SafeStoragePort } from '../electron/vault.js';
import { ElectronMainAuthAdapter } from '../electron/main-adapter.js';
import { WebBffAuthAdapter, FLOW_COOKIE, SESSION_COOKIE, type BffRequest } from '../web/bff-adapter.js';
import { MemoryWebSessionStore } from '../web/session-store.js';
import type { WorkspaceRpcContracts, WorkspaceRpcName, WorkspaceRpcPort } from '../common/rpc.js';
export const U1 = '00000000-0000-0000-0000-000000000001', U2 = U1.slice(0,-1)+'2';
export const AUTH = 'https://synthetic-auth.invalid', APP = 'https://synthetic-workspace.invalid';
export const SCHOOL_A = '10000000-0000-0000-0000-000000000001', SCHOOL_B = SCHOOL_A.slice(0,-1)+'2';
export const secret = (userId = U1, expiresAt = Date.now()+3600000): SecretSession =>
  ({ userId, accessToken: 'MOCK_ACCESS_PRIVATE_'+userId, refreshToken: 'MOCK_REFRESH_PRIVATE_'+userId, expiresAt });
export function deferred<T>() { let resolve!: (v:T)=>void, reject!: (e:unknown)=>void;
  const promise = new Promise<T>((r,j) => { resolve=r; reject=j; }); return { promise,resolve,reject }; }
export class MockIdentityProvider implements IdentityProvider {
  readonly evidence = 'MOCK';
  starts: { flowId:string; redirectTo:string }[] = [];
  next = secret();
  exchangeImpl: () => Promise<SecretSession> = async () => ({ ...this.next });
  refreshImpl: () => Promise<SecretSession> = async () => ({ ...this.next, expiresAt: Date.now()+3600000 });
  start = vi.fn(async (v: { flowId: string; redirectTo:string }) => { this.starts.push(v); return AUTH+'/auth/v1/authorize?provider=google'; });
  exchange = vi.fn(async () => this.exchangeImpl());
  refresh = vi.fn(async () => this.refreshImpl());
  forget = vi.fn();
  revoke = vi.fn(async () => undefined);
  callback(i = this.starts.length-1): string { const u = new URL(this.starts[i].redirectTo); u.searchParams.set('code','MOCK_CODE'); return u.href; }
}
export class MockCipherBlob implements CipherBlobPort {
  value: Buffer | null = null;
  read = vi.fn(async () => this.value);
  replace = vi.fn(async (v:Buffer) => { this.value=Buffer.from(v); });
  remove = vi.fn(async () => { this.value=null; });
}
/** MOCK only: checks adapter ownership/failure paths, not Windows DPAPI cryptography. */
export const mockSafeStorage = (): SafeStoragePort => ({ isEncryptionAvailable: () => true,
  encryptString: s => Buffer.from('MOCK_CIPHER:'+Buffer.from(s).toString('base64')),
  decryptString: b => { if (!b.toString().startsWith('MOCK_CIPHER:')) throw Error('corrupt MOCK_ACCESS_PRIVATE'); return Buffer.from(b.toString().slice(12),'base64').toString(); } });
export function electronSetup(now: () => number = Date.now) {
  const provider=new MockIdentityProvider(),blob=new MockCipherBlob(),safe=mockSafeStorage();
  const vault=new WindowsSessionVault(safe,blob,'win32'), open=vi.fn(async () => undefined);
  const adapter=new ElectronMainAuthAdapter(provider,vault,new CallbackFlows('bogunon-desk://workspace-auth/callback',now),open,AUTH,undefined,now);
  return { provider,blob,safe,vault,open,adapter };
}
export function rpcContext(schoolId=SCHOOL_A): WorkspaceRpcContracts['ws_v1_get_context']['result'] {
  return { school_id:schoolId,role:'HEALTH_TEACHER',member_code:'M-MOCK',epoch:1,version:1,permissions:['task.read'] };
}
export class MockSchool01aRpc implements WorkspaceRpcPort {
  readonly evidence = 'MOCK' as const;
  context = rpcContext();
  onCall: ((name:WorkspaceRpcName,args:unknown,signal:AbortSignal)=>Promise<unknown>) | null = null;
  async call<N extends WorkspaceRpcName>(name:N,args:WorkspaceRpcContracts[N]['args'],signal:AbortSignal):Promise<WorkspaceRpcContracts[N]['result']> {
    if (this.onCall) return await this.onCall(name,args,signal) as WorkspaceRpcContracts[N]['result'];
    if (name==='ws_v1_get_context') return this.context as WorkspaceRpcContracts[N]['result'];
    throw new WorkspaceAuthError('ACCESS_DENIED');
  }
}
export const request = (cookies: Record<string,string>={}, csrfToken?:string): BffRequest =>
  ({method:'POST',origin:APP,cookies,csrfToken});
export function readSetCookie(cookies:readonly string[],name:string):string {
  return cookies.find(c=>c.startsWith(name+'='))!.split(';')[0].slice(name.length+1);
}
export function webSetup(now:()=>number=Date.now) {
  const provider=new MockIdentityProvider(),store=new MemoryWebSessionStore();
  const bff=new WebBffAuthAdapter(provider,store,new CallbackFlows(APP+'/auth/callback',now),APP,AUTH,'test',now);
  async function login() {
    const start=await bff.begin(request()), flow=readSetCookie(start.setCookies,FLOW_COOKIE);
    const result=await bff.callback(provider.callback(),{[FLOW_COOKIE]:flow});
    const handle=readSetCookie(result.setCookies,SESSION_COOKIE);
    return { result,handle,flow,req:request({[SESSION_COOKIE]:handle},result.csrfToken) };
  }
  return {provider,store,bff,login};
}
