import {readFile} from 'node:fs/promises';
import {WindowsSessionVault} from '../../auth/electron/vault.js';
import {ElectronMainAuthAdapter} from '../../auth/electron/main-adapter.js';
import {CallbackFlows} from '../../auth/server/flow.js';
import {WebBffAuthAdapter,SESSION_COOKIE,FLOW_COOKIE,type BffRequest} from '../../auth/web/bff-adapter.js';
import {MemoryWebSessionStore} from '../../auth/web/session-store.js';
import {MockCipherBlob,mockSafeStorage,readSetCookie} from '../../auth/tests/fixtures.js';
import {SyntheticIdentityProvider,SyntheticTokenRegistry,LocalDatabaseRpcTransport,localSql} from '../server/local-db.js';
import {electronWorkspacePort,webWorkspacePort} from '../server/platform-ports.js';
import {WorkspaceCoordinator} from '../core/workspace.js';
export const A='10000000-0000-0000-0000-000000000001',B=A.slice(0,-1)+'2';
export const user=(i:number)=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
export const member=(i:number)=>`20000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
export async function resetDatabase():Promise<void>{
 await localSql(await readFile('school-workspace/local/tests/fixtures.sql','utf8'));
 await localSql(await readFile('school-workspace/integration/sql/multi-school-fixture.sql','utf8'));
}
export function electronRig(i=3){
 const registry=new SyntheticTokenRegistry(),provider=new SyntheticIdentityProvider(registry),transport=new LocalDatabaseRpcTransport(registry);
 provider.userId=user(i);provider.sessionId=`30000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
 const blob=new MockCipherBlob(),safe=mockSafeStorage(),vault=new WindowsSessionVault(safe,blob,'win32');
 const auth=new ElectronMainAuthAdapter(provider,vault,new CallbackFlows('bogunon-desk://workspace-auth/callback'),async()=>undefined,'https://school01c-auth.invalid');
 const port=electronWorkspacePort(auth,transport,async()=>{await auth.beginSignIn();await auth.handleCallback(provider.callback());});
 const controller=new WorkspaceCoordinator(port);
 return{controller,auth,port,provider,registry,transport,safe,blob};
}
export function webRig(i=3){
 const registry=new SyntheticTokenRegistry(),provider=new SyntheticIdentityProvider(registry),transport=new LocalDatabaseRpcTransport(registry);
 provider.userId=user(i);provider.sessionId=`30000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
 const store=new MemoryWebSessionStore(),origin='https://school01c-web.invalid';
 const bff=new WebBffAuthAdapter(provider,store,new CallbackFlows(origin+'/callback'),origin,'https://school01c-auth.invalid','test');
 let request:BffRequest={method:'POST',origin,cookies:{}};
 const port=webWorkspacePort(bff,transport,()=>request,async()=>{
  const start=await bff.begin(request),flow=readSetCookie(start.setCookies,FLOW_COOKIE);
  const done=await bff.callback(provider.callback(),{[FLOW_COOKIE]:flow});
  request={method:'POST',origin,cookies:{[SESSION_COOKIE]:readSetCookie(done.setCookies,SESSION_COOKIE)},csrfToken:done.csrfToken};
 });
 const controller=new WorkspaceCoordinator(port);
 return{controller,bff,store,port,provider,registry,transport,getRequest:()=>request};
}
