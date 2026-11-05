import { createClient } from '@supabase/supabase-js';
import { WorkspaceAuthError } from '../common/types.js';
import { WORKSPACE_RPC_NAMES, type WorkspaceRpcContracts, type WorkspaceRpcName, type WorkspaceRpcPort } from '../common/rpc.js';
export interface UserScopedRpcTransport {
  readonly evidence: 'MOCK' | 'SERVER';
  invoke(accessToken: string, name: WorkspaceRpcName, args: object, signal: AbortSignal): Promise<unknown>;
}
const keys: Record<WorkspaceRpcName, readonly string[]> = {
 ws_v1_bootstrap:[], ws_v1_get_context:['p_school_id'],
 ws_v1_request_join:['p_school_id','p_requested_role','p_request_id'],
 ws_v1_decide_join:['p_school_id','p_join_request_id','p_decision','p_approved_role','p_valid_until','p_expected_version','p_request_id'],
 ws_v1_set_member_role:['p_school_id','p_membership_id','p_new_role','p_expected_version','p_request_id'],
 ws_v1_set_membership_state:['p_school_id','p_membership_id','p_state','p_expected_version','p_request_id'],
 ws_v1_leave_school:['p_school_id','p_expected_version','p_request_id'],
};
const uuid = (v: unknown): v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const positive = (v:unknown): v is number => Number.isSafeInteger(v) && (v as number)>0;
const record = (v:unknown): v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v);
function checkedArgs(name:WorkspaceRpcName,args:unknown):object {
  if (!WORKSPACE_RPC_NAMES.includes(name) || !record(args) || Object.keys(args).sort().join()!==[...keys[name]].sort().join()) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  for(const [k,v] of Object.entries(args)) {
    if ((k.endsWith('_id') && !uuid(v)) || (k==='p_expected_version' && !positive(v))) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
    if (['p_requested_role','p_new_role'].includes(k) && !['HEALTH_TEACHER','HEALTH_ASSISTANT'].includes(v as string)) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
    if (k==='p_approved_role' && v!==null && !['HEALTH_TEACHER','HEALTH_ASSISTANT'].includes(v as string)) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
    if (k==='p_state' && !['active','suspended','revoked'].includes(v as string)) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
    if (k==='p_decision' && !['approve','reject'].includes(v as string)) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
    if (k==='p_valid_until' && v!==null && (typeof v!=='string' || !Number.isFinite(Date.parse(v)))) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  }
  return {...args};
}
function checkedResult<N extends WorkspaceRpcName>(name:N,value:unknown):WorkspaceRpcContracts[N]['result'] {
  if (!record(value)) throw new WorkspaceAuthError('AUTH_SERVER_ERROR');
  let result:unknown;
  switch(name) {
    case 'ws_v1_bootstrap': if(uuid(value.actor_id)) result={actor_id:value.actor_id}; break;
    case 'ws_v1_get_context':
      if(uuid(value.school_id) && ['SCHOOL_ADMIN','HEALTH_TEACHER','HEALTH_ASSISTANT'].includes(value.role as string)
       && typeof value.member_code==='string' && value.member_code.length<=80 && positive(value.epoch) && positive(value.version)
       && Array.isArray(value.permissions) && value.permissions.length<=100 && value.permissions.every(p=>typeof p==='string' && p.length<=100))
       result={school_id:value.school_id,role:value.role,member_code:value.member_code,epoch:value.epoch,version:value.version,permissions:[...value.permissions]}; break;
    case 'ws_v1_request_join': if(uuid(value.join_request_id) && uuid(value.membership_id) && positive(value.epoch)) result={join_request_id:value.join_request_id,membership_id:value.membership_id,epoch:value.epoch};break;
    case 'ws_v1_decide_join': if(typeof value.approved==='boolean') result={approved:value.approved};break;
    case 'ws_v1_leave_school': if(typeof value.left==='boolean') result={left:value.left};break;
    default: if(positive(value.version)) result={version:value.version};
  }
  if(!result) throw new WorkspaceAuthError('AUTH_SERVER_ERROR');
  return result as WorkspaceRpcContracts[N]['result'];
}
// Shape/role rejection only, NOT JWT signature verification. Real verification remains at the Auth/API server.
function assertUserAccess(token:string,evidence:'MOCK'|'SERVER'):void {
  if (!token || token.startsWith('sb_')) throw new WorkspaceAuthError('UNAUTHENTICATED');
  const parts=token.split('.');
  if(parts.length===3) {
    try { const body=JSON.parse(Buffer.from(parts[1],'base64url').toString()); if(body.role!=='authenticated') throw Error(); }
    catch { throw new WorkspaceAuthError('UNAUTHENTICATED'); }
  } else if(evidence!=='MOCK' || !token.startsWith('MOCK_')) throw new WorkspaceAuthError('UNAUTHENTICATED');
}
/** Main/BFF only. Current access token is supplied by its authenticated adapter, never by Renderer arguments. */
export function userScopedRpc(accessToken:string,transport:UserScopedRpcTransport):WorkspaceRpcPort {
  assertUserAccess(accessToken,transport.evidence);
  return { evidence:transport.evidence, async call<N extends WorkspaceRpcName>(name:N,args:WorkspaceRpcContracts[N]['args'],signal:AbortSignal) {
    if(signal.aborted) throw new WorkspaceAuthError('STALE_RESPONSE');
    const result=await transport.invoke(accessToken,name,checkedArgs(name,args),signal);
    if(signal.aborted) throw new WorkspaceAuthError('STALE_RESPONSE');
    return checkedResult(name,result);
  } };
}
/** REAL SDK adapter, no default network. Tests inject fake-host HTTP responses; production RPCs were not called. */
export class SupabaseUserRpcTransport implements UserScopedRpcTransport {
  constructor(private readonly origin:string,private readonly publishableKey:string,readonly evidence:'MOCK'|'SERVER',
    private readonly transport:typeof fetch=async()=>{throw new WorkspaceAuthError('CONFIGURATION_ERROR');}) {
    if (new URL(origin).protocol!=='https:' || new URL(origin).origin!==origin || !publishableKey.startsWith('sb_publishable_')) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  }
  async invoke(accessToken:string,name:WorkspaceRpcName,args:object,signal:AbortSignal):Promise<unknown> {
    if (!WORKSPACE_RPC_NAMES.includes(name)) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
    assertUserAccess(accessToken,this.evidence);
    const client=createClient(this.origin,this.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{headers:{Authorization:`Bearer ${accessToken}`},fetch:(input,init)=>{
        const u=new URL(input instanceof Request?input.url:String(input));
        if(u.origin!==this.origin || u.pathname!==`/rest/v1/rpc/${name}` || init?.method!=='POST') throw new WorkspaceAuthError('CONFIGURATION_ERROR');
        return this.transport(input,{...init,redirect:'error'});
      }}});
    const {data,error,status}=await client.rpc(name,args).abortSignal(signal);
    if(error) throw new WorkspaceAuthError(status===401?'UNAUTHENTICATED':status===403?'ACCESS_DENIED':'AUTH_SERVER_ERROR');
    return data;
  }
}
