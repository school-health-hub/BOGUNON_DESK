/** Local synthetic gateway only. No database URL, SDK networking or hosted fallback. */
import {execFile} from 'node:child_process';import{promisify}from'node:util';
import{literal,SyntheticTokenRegistry}from'../../integration/server/local-db.js';
import{WorkspaceAuthError}from'../../auth/common/types.js';
import type{UserScopedRpcTransport}from'../../auth/server/rpc-adapter.js';
import{userScopedRpc}from'../../auth/server/rpc-adapter.js';
import type{WorkspaceRpcName,WorkspaceRpcContracts}from'../../auth/common/rpc.js';
import type{MembershipSnapshot}from'../../integration/core/workspace.js';
const exec=promisify(execFile),env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'].includes(k)));
export async function sql(q:string,user='postgres',signal?:AbortSignal){const{stdout}=await exec('docker',['--host=unix:///var/run/docker.sock','exec','bogunon-school02-pg','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','school01a','-c',q],{env,signal,timeout:15000,maxBuffer:1024*1024});return stdout.trim();}
const orders:Record<string,readonly string[]>={ws_v1_bootstrap:[],ws_v1_get_context:['p_school_id'],ws_v1_request_join:['p_school_id','p_requested_role','p_request_id'],ws_v1_decide_join:['p_school_id','p_join_request_id','p_decision','p_approved_role','p_valid_until','p_expected_version','p_request_id'],ws_v1_set_member_role:['p_school_id','p_membership_id','p_new_role','p_expected_version','p_request_id'],ws_v1_set_membership_state:['p_school_id','p_membership_id','p_state','p_expected_version','p_request_id'],ws_v1_leave_school:['p_school_id','p_expected_version','p_request_id'],ws_v1_propose_admin_change:['p_school_id','p_target_membership_id','p_mode','p_request_id'],ws_v1_accept_admin_change:['p_school_id','p_transfer_id','p_expected_version','p_request_id'],ws_c_membership_status:['p_school_id'],ws_s02_directory:['q','o'],ws_s02_self:[],ws_s02_admin:['s'],ws_s02_space:['s','r'],ws_s02_withdraw:['s','j','ev','r'],ws_s02_expiry:['s','mid','until_at','ev','r'],ws_s02_transfers:['s']};
export class LocalSchoolDatabase implements UserScopedRpcTransport{
 readonly evidence='SERVER' as const;readonly classification='LOCAL DB + MOCK AUTH';offline=false;calls=0;
 constructor(readonly registry:SyntheticTokenRegistry,private readonly execute:typeof sql=sql){}
 async invoke(token:string,name:string,args:object,signal:AbortSignal):Promise<unknown>{
  if(this.offline)throw new Error('network');const keys=orders[name];
  if(!keys||Object.keys(args).sort().join()!==[...keys].sort().join())throw new Error('invalid_request');
  const c=this.registry.resolve(token);this.calls++;
  try{return JSON.parse(await this.execute(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=${literal(JSON.stringify(c))};SELECT public.${name}(${keys.map(k=>literal((args as Record<string,unknown>)[k])).join(',')});COMMIT;`,'school_client',signal));}
  catch(e){if(signal.aborted)throw new WorkspaceAuthError('STALE_RESPONSE');const t=String((e as{stderr?:string}).stderr??'');if(t.includes('unauthenticated_or_revoked'))throw new WorkspaceAuthError('UNAUTHENTICATED');
   if(/access_denied|admin_required|not_found_or_denied|self_approval|last_admin|eligible_teacher_required|invalid_transfer/.test(t))throw new WorkspaceAuthError('ACCESS_DENIED');
   if(/conflict|membership_not_rejoinable|duplicate_request|one_pending_join/.test(t))throw new Error('conflict');if(t.includes('reauth_required'))throw new Error('reauth');if(/invalid_|assistant_end_required/.test(t))throw new Error('input');throw new Error('network');}
 }
 async original<N extends WorkspaceRpcName>(token:string,name:N,args:WorkspaceRpcContracts[N]['args'],signal:AbortSignal){return userScopedRpc(token,this).call(name,args,signal);}
 async membership(token:string,s:string,signal:AbortSignal){return await this.invoke(token,'ws_c_membership_status',{p_school_id:s},signal)as MembershipSnapshot;}
}
