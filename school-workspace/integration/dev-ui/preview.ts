import {WorkspaceCoordinator,WorkspaceFault,type IntegratedWorkspacePort} from '../core/workspace.js';
import type {WorkspaceAuthStatus} from '../../auth/common/types.js';
/** Browser-only MOCK preview. No credentials, no network and no authorization claims. */
export function createPreview(scenario='active'):WorkspaceCoordinator{
 let signed=false;
 const port:IntegratedWorkspacePort={
  async authStatus():Promise<WorkspaceAuthStatus>{return signed?{kind:'authenticated',session:{user:{id:'synthetic-account'},expiresAt:Date.now()+3600000}}:{kind:'signed_out'};},
  async login(){signed=true;},async logout(){signed=false;},invalidate(){},
  async bootstrap(){return{actor_id:'synthetic-actor'};},
  async membership(){if(scenario==='session-expired')throw new WorkspaceFault('expired_session');return{status:scenario==='pending'?'pending':scenario==='denied'?'access_denied':'active'};},
  async context(schoolId){return{schoolId,role:'HEALTH_TEACHER',memberCode:'M-DEMO',epoch:1,version:1,permissions:['task.read'],evidence:'MOCK'};},
  async rpc(){throw new WorkspaceFault('access_denied');},
 };
 return new WorkspaceCoordinator(port);
}
