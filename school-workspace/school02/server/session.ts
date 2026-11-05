import type{SecretVault}from'../../auth/server/ports.js';
import{ElectronMainAuthAdapter}from'../../auth/electron/main-adapter.js';import{WindowsSessionVault}from'../../auth/electron/vault.js';
import{WebBffAuthAdapter,type BffRequest}from'../../auth/web/bff-adapter.js';import{MemoryWebSessionStore}from'../../auth/web/session-store.js';
import{CallbackFlows}from'../../auth/server/flow.js';import{MockCipherBlob,mockSafeStorage,readSetCookie}from'../../auth/tests/fixtures.js';
import{SyntheticTokenRegistry,SyntheticIdentityProvider}from'../../integration/server/local-db.js';
import{WorkspaceCoordinator,type IntegratedWorkspacePort}from'../../integration/core/workspace.js';import{WorkspaceRequestScope}from'../../auth/common/rpc.js';
import{WorkspaceAuthError}from'../../auth/common/types.js';import{userScopedRpc}from'../../auth/server/rpc-adapter.js';
import{LocalSchoolDatabase,sql}from'./database.js';import{SchoolController}from'../core/controller.js';
export const uid=(i:number)=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`,sid=(i:number)=>`30000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
export const ORIGIN='https://127.0.0.1:5192';
export function createSchoolSession(kind:'electron'|'web',index=11,options:{databaseFactory?:(registry:SyntheticTokenRegistry)=>LocalSchoolDatabase;execute?:typeof sql;origin?:string;vault?:SecretVault}={}){
 const registry=new SyntheticTokenRegistry(),provider=new SyntheticIdentityProvider(registry),database=options.databaseFactory?.(registry)??new LocalSchoolDatabase(registry);provider.userId=uid(index);provider.sessionId=sid(index);
 const blob=new MockCipherBlob(),safe=mockSafeStorage(),auth=new ElectronMainAuthAdapter(provider,options.vault??new WindowsSessionVault(safe,blob,'win32'),new CallbackFlows('bogunon-desk://workspace-auth/callback'),async()=>undefined,'https://school01c-auth.invalid');
 const origin=options.origin??ORIGIN;
 const bff=new WebBffAuthAdapter(provider,new MemoryWebSessionStore(),new CallbackFlows(origin+'/callback'),origin,'https://school01c-auth.invalid','test');
 let request:BffRequest={method:'POST',origin,cookies:{}},setCookies:readonly string[]=[];
 const run=<T>(fn:(token:string,signal:AbortSignal)=>Promise<T>)=>kind==='electron'?auth.runAuthorized(fn):bff.runAccountRequest(request,fn);
 const contextScope=new WorkspaceRequestScope();
 const port:IntegratedWorkspacePort={
  authStatus:()=>kind==='electron'?auth.getStatus():request.cookies['__Host-ws_session']?bff.status(request):Promise.resolve({kind:'signed_out'}),
  login:async()=>{if(kind==='electron'){await auth.beginSignIn();await auth.handleCallback(provider.callback());}else{const begin=await bff.begin(request),done=await bff.callback(provider.callback(),{'__Host-ws_flow':readSetCookie(begin.setCookies,'__Host-ws_flow')});setCookies=done.setCookies;request={method:'POST',origin,csrfToken:done.csrfToken,cookies:{'__Host-ws_session':readSetCookie(done.setCookies,'__Host-ws_session')}};}},
  logout:async()=>{if(kind==='electron')await auth.logout();else{setCookies=(await bff.logout(request)).setCookies;request={method:'POST',origin,cookies:{}};}},
  invalidate:()=>{contextScope.invalidate();auth.workspace.invalidate();},
  bootstrap:s=>run(t=>database.original(t,'ws_v1_bootstrap',{},s)),membership:(school,s)=>run(t=>database.membership(t,school,s)),
  context:(school,_signal)=>run(t=>contextScope.switchSchool(userScopedRpc(t,database),school)),
  rpc:(name,args,signal)=>run(t=>database.original(t,name,args,signal)),
 };
 const workspace=new WorkspaceCoordinator(port);
 const controller=new SchoolController({workspace,call:(name,args,signal)=>run(async token=>{
  if(name.startsWith('ws_v1_')&&!['ws_v1_propose_admin_change','ws_v1_accept_admin_change'].includes(name))return userScopedRpc(token,database).call(name as Parameters<typeof database.original>[1],args as never,signal);
  return database.invoke(token,name,args,signal);
 }),reauth:async()=>{
  // MOCK reauthentication only: test fixture explicitly updates synthetic session evidence.
  // No hosted/real Auth action is implemented or implied.
  const status=await port.authStatus();if(status.kind!=='authenticated')throw new WorkspaceAuthError('UNAUTHENTICATED');
  await (options.execute??sql)(`UPDATE auth.sessions SET created_at=statement_timestamp() WHERE id='${sid(index)}' AND user_id='${uid(index)}'`);
 }});
 return{run,controller,workspace,auth,bff,provider,database,registry,blob,safe,getRequest:()=>request,setRequest:(v:BffRequest)=>{request=v;},getCookies:()=>setCookies};
}
