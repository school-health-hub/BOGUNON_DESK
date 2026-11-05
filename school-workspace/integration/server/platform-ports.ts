import type { IntegratedWorkspacePort } from '../core/workspace.js';
import type { ElectronMainAuthAdapter } from '../../auth/electron/main-adapter.js';
import type { WebBffAuthAdapter,BffRequest } from '../../auth/web/bff-adapter.js';
import { userScopedRpc } from '../../auth/server/rpc-adapter.js';
import type { LocalDatabaseRpcTransport } from './local-db.js';
import { WorkspaceAuthError, type WorkspaceMembershipContext } from '../../auth/common/types.js';
import { WorkspaceRequestScope } from '../../auth/common/rpc.js';
export function electronWorkspacePort(auth:ElectronMainAuthAdapter,transport:LocalDatabaseRpcTransport,login:()=>Promise<void>):IntegratedWorkspacePort{
 const contextScope=new WorkspaceRequestScope();
 return{
  authStatus:()=>auth.getStatus(),login,logout:()=>auth.logout(),invalidate:()=>{contextScope.invalidate();auth.workspace.invalidate();},
  bootstrap:signal=>auth.runAuthorized(t=>userScopedRpc(t,transport).call('ws_v1_bootstrap',{},signal)),
  membership:(s,signal)=>auth.runAuthorized(t=>transport.membership(t,s,signal)),
  context:(s,_signal)=>auth.runAuthorized(t=>contextScope.switchSchool(userScopedRpc(t,transport),s)),
  rpc:(name,args,signal)=>auth.runAuthorized(t=>userScopedRpc(t,transport).call(name,args,signal)),
 };
}
export function webWorkspacePort(bff:WebBffAuthAdapter,transport:LocalDatabaseRpcTransport,getRequest:()=>BffRequest,login:()=>Promise<void>):IntegratedWorkspacePort{
 const local=new WorkspaceRequestScope();let approved:WorkspaceMembershipContext|null=null;
 return{
  authStatus:async()=>{const req=getRequest();if(!req.cookies['__Host-ws_session'])return{kind:'signed_out'};try{return await bff.status(req);}catch(e){if(e instanceof WorkspaceAuthError&&e.code==='UNAUTHENTICATED')return{kind:'expired'};throw e;}},login,logout:async()=>{await bff.logout(getRequest());},invalidate:()=>{local.invalidate();approved=null;},
  bootstrap:async signal=>{
   // The BFF method below obtains token server-side and validates Origin/CSRF without requiring a selected school.
   return bff.runAccountRequest(getRequest(),t=>userScopedRpc(t,transport).call('ws_v1_bootstrap',{},signal));
  },
  membership:(s,signal)=>bff.runAccountRequest(getRequest(),t=>transport.membership(t,s,signal)),
  context:async(s,_signal)=>{approved=await bff.switchSchool(getRequest(),s,t=>userScopedRpc(t,transport));return approved;},
  rpc:async(name,args,signal)=>{if(!approved||('p_school_id'in args&&args.p_school_id!==approved.schoolId))throw new WorkspaceAuthError('ACCESS_DENIED');return bff.runWorkspace(getRequest(),t=>userScopedRpc(t,transport).call(name,args,signal));},
 };
}
