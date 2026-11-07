import type {ProductRuntime} from '../../../electron-p0/main/workspace-product.js';
import {WorkspaceCoordinator,type IntegratedWorkspacePort,type MembershipSnapshot} from '../../integration/core/workspace.js';
import {WorkspaceRequestScope} from '../../auth/common/rpc.js';
import {WorkspaceAuthError} from '../../auth/common/types.js';
import {userScopedRpc} from '../../auth/server/rpc-adapter.js';
import {SchoolController} from '../../school02/core/controller.js';
import type {Action} from '../../school02/core/types.js';
import {TaskController} from '../../school03/core/controller.js';
import {TaskFault,type TaskAction,type Board} from '../../school03/core/types.js';
import {ActivityController} from '../../school04/core/controller.js';
import type {Action as ActivityAction} from '../../school04/core/types.js';
import {InventoryController} from '../../school07/core/controller.js';
import {InstructorController} from '../../instructors/core/controller.js';
import {H1Auth} from './auth.js';
import {H1Error} from './http.js';
/** Existing DTO/controllers, real user-scoped HTTP; no SQL executor or synthetic identity registry. */
export function createH1Runtime(auth:H1Auth):ProductRuntime{
 let disposed=false,disposal:Promise<void>|undefined;const context=new WorkspaceRequestScope();
 const invoke=async(n:string,a:object,s:AbortSignal)=>{if(disposed||s.aborted)throw new WorkspaceAuthError('STALE_RESPONSE');try{return await auth.authorized((token,owned)=>auth.http.rpc(token,n,a,AbortSignal.any([s,owned])));}catch(e){if(e instanceof H1Error){if(e.code==='AUTH')throw new WorkspaceAuthError('UNAUTHENTICATED');if(e.code==='DENIED')throw new WorkspaceAuthError('ACCESS_DENIED');if(e.code==='STALE')throw new WorkspaceAuthError('STALE_RESPONSE');throw Error(e.code==='CONFLICT'?'conflict':e.code==='REAUTH'?'reauth':e.code==='INPUT'?'input':'network');}throw e;}};
 const port:IntegratedWorkspacePort={authStatus:()=>auth.status(),login:async signal=>{try{await auth.login(signal);}catch(e){if(e instanceof WorkspaceAuthError)throw e;throw new WorkspaceAuthError(e instanceof H1Error&&e.code==='STALE'?'STALE_RESPONSE':'AUTH_SERVER_ERROR');}},logout:()=>auth.logout(),invalidate:()=>{context.invalidate();auth.scope.invalidate();},bootstrap:s=>invoke('ws_v1_bootstrap',{},s)as Promise<{actor_id:string}>,membership:(school,s)=>invoke('ws_c_membership_status',{p_school_id:school},s)as Promise<MembershipSnapshot>,context:(school,_s)=>auth.authorized(token=>context.switchSchool(userScopedRpc(token,{evidence:'SERVER',invoke:(_t,n,a,s)=>invoke(n,a,s)}),school)),rpc:(n,a,s)=>invoke(n,a,s)as never};
 // Context validation uses the current verified access token and the shared strict DTO decoder.
 // Keep admin changes closed until the server can verify and consume purpose-bound step-up evidence.
 const coordinator=new WorkspaceCoordinator(port),school=new SchoolController({workspace:coordinator,call:invoke});
 const taskCall=async(n:string,a:object,s:AbortSignal)=>{try{return await invoke(n,a,s);}catch(e){if(e instanceof WorkspaceAuthError)throw new TaskFault(e.code==='UNAUTHENTICATED'?'EXPIRED':e.code==='STALE_RESPONSE'?'STALE':'DENIED');throw new TaskFault(e instanceof Error&&e.message==='conflict'?'CONFLICT':e instanceof Error&&e.message==='input'?'INPUT':'NETWORK');}};
 const schoolPort=(a:'select'|'refresh',i?:Record<string,unknown>)=>school.command(a,i);
 const tasks=new TaskController({school:schoolPort,call:taskCall}),activity=new ActivityController({school:schoolPort,call:taskCall,tasks:(s,signal)=>taskCall('ws_v1_list_tasks',{p_school_id:s,p_status:null,p_sort:'DUE',p_scope:'MINE',p_include_archived:false},signal)as Promise<Board>}),inventory=new InventoryController({school:schoolPort,call:taskCall}),instructor=new InstructorController({school:()=>school.command('refresh'),call:taskCall});
 const clear=()=>{tasks.invalidate();activity.invalidate();inventory.invalidate();instructor.invalidate();auth.scope.invalidate();context.invalidate();};
 return{accounts:[],account:0,school:async(a,i)=>{if(disposed)throw Error('disposed');if(['login','logout','select'].includes(a))clear();const result=await school.command(a as Action,i);if(['signed_out','expired_session','network_error','access_denied'].includes(result.workspace.phase))clear();return result;},tasks:(a,i)=>tasks.command(a as TaskAction,i),activity:(a,i)=>activity.command(a as ActivityAction,i),inventory:(a,i)=>inventory.command(a as import('../../school07/core/types.js').Action,i),instructor:(a,i)=>instructor.command(a as import('../../instructors/core/types.js').Action,i),instructorIdentity:async s=>{const st=await school.command('refresh'),a=await auth.status();if(disposed||st.selected!==s||st.workspace.phase!=='approved'||!['SCHOOL_ADMIN','HEALTH_TEACHER'].includes(st.workspace.context?.role??'')||a.kind!=='authenticated')throw Error('denied');return a.session.user.id;},switchAccount:async()=>{clear();await school.command('logout');},dispose:()=>{if(disposal)return disposal;disposed=true;clear();disposal=auth.dispose();return disposal;}};
}
