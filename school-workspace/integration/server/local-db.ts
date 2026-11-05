/** TEST/LOCAL DEVELOPMENT ONLY. Hard-coded local Docker socket/container/DB, no remote URL. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import type { SecretSession,IdentityProvider } from '../../auth/server/ports.js';
import type { UserScopedRpcTransport } from '../../auth/server/rpc-adapter.js';
import type { WorkspaceRpcName } from '../../auth/common/rpc.js';
import { WorkspaceAuthError } from '../../auth/common/types.js';
import { WorkspaceFault,type MembershipSnapshot } from '../core/workspace.js';
const exec=promisify(execFile);
export const LOCAL_CONTAINER='bogunon-school01c-pg';
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'].includes(k)));
export function literal(v:unknown):string {
 if(v===null)return 'NULL';if(typeof v==='number'&&Number.isSafeInteger(v))return String(v);
 if(typeof v!=='string'||v.length>4096)throw new WorkspaceAuthError('CONFIGURATION_ERROR');return "'"+v.replaceAll("'","''")+"'";
}
export async function localSql(sql:string,user='postgres',signal?:AbortSignal):Promise<string>{
 const args=['--host=unix:///var/run/docker.sock','exec',LOCAL_CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','school01a','-c',sql];
 const {stdout}=await exec('docker',args,{env,signal,timeout:15000,maxBuffer:1024*1024});return stdout.trim();
}
export class SyntheticTokenRegistry {
  #sessions=new Map<string,{userId:string;sessionId:string;expiresAt:number}>();
  issue(userId:string,sessionId:string,expiresAt=Date.now()+3600000):SecretSession {
    const body=Buffer.from(JSON.stringify({role:'authenticated',sub:userId,session_id:sessionId,exp:Math.floor(expiresAt/1000)})).toString('base64url');
    const accessToken='SCHOOL01C_MOCK.'+body+'.'+randomBytes(24).toString('base64url');
    this.#sessions.set(accessToken,{userId,sessionId,expiresAt});
    return {userId,accessToken,refreshToken:'SCHOOL01C_MOCK_REFRESH_'+randomBytes(24).toString('base64url'),expiresAt};
  }
  resolve(token:string):{sub:string;session_id:string;exp:number;is_anonymous:false}{
    const s=this.#sessions.get(token);if(!s||s.expiresAt<=Date.now())throw new WorkspaceAuthError('UNAUTHENTICATED');
    return{sub:s.userId,session_id:s.sessionId,exp:Math.floor(s.expiresAt/1000),is_anonymous:false};
  }
  revoke(token:string):void{this.#sessions.delete(token);}
}
/** Auth is MOCK. Exact opaque token registry, not trusting arbitrary decoded claims. */
export class SyntheticIdentityProvider implements IdentityProvider {
  readonly evidence='MOCK_AUTH';lastRedirect='';userId='00000000-0000-0000-0000-000000000003';sessionId='30000000-0000-0000-0000-000000000003';
  expiresAt=Date.now()+3600000;refreshes=0;
  constructor(readonly registry:SyntheticTokenRegistry){}
  async start(i:{flowId:string;redirectTo:string}):Promise<string>{this.lastRedirect=i.redirectTo;return 'https://school01c-auth.invalid/auth/v1/authorize';}
  async exchange():Promise<SecretSession>{return this.registry.issue(this.userId,this.sessionId,this.expiresAt);}
  forget():void{}
  async refresh(s:SecretSession):Promise<SecretSession>{this.refreshes++;return this.registry.issue(s.userId,this.sessionId,Date.now()+3600000);}
  async revoke(s:SecretSession):Promise<void>{this.registry.revoke(s.accessToken);}
  callback():string{const u=new URL(this.lastRedirect);u.searchParams.set('code','SYNTHETIC_CODE');return u.href;}
}
const order:Record<WorkspaceRpcName,readonly string[]>={
 ws_v1_bootstrap:[],ws_v1_get_context:['p_school_id'],ws_v1_request_join:['p_school_id','p_requested_role','p_request_id'],
 ws_v1_decide_join:['p_school_id','p_join_request_id','p_decision','p_approved_role','p_valid_until','p_expected_version','p_request_id'],
 ws_v1_set_member_role:['p_school_id','p_membership_id','p_new_role','p_expected_version','p_request_id'],
 ws_v1_set_membership_state:['p_school_id','p_membership_id','p_state','p_expected_version','p_request_id'],
 ws_v1_leave_school:['p_school_id','p_expected_version','p_request_id'],
};
export class LocalDatabaseRpcTransport implements UserScopedRpcTransport {
 readonly evidence='SERVER' as const;readonly verification='LOCAL_DB' as const;calls=0;offline=false;
 constructor(private readonly tokens:SyntheticTokenRegistry){}
 private async query(token:string,name:string,args:readonly unknown[],signal:AbortSignal):Promise<unknown>{
  if(this.offline)throw new WorkspaceFault('network_error');
  const claims=this.tokens.resolve(token);this.calls++;
  const q=`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=${literal(JSON.stringify(claims))};SELECT public.${name}(${args.map(literal).join(',')});COMMIT;`;
  try{const s=await localSql(q,'school_client',signal);return JSON.parse(s);}
  catch(e){
   if(signal.aborted)throw new WorkspaceAuthError('STALE_RESPONSE');
   const text=String((e as {stderr?:string}).stderr??'');
   if(text.includes('conflict'))throw new WorkspaceFault('conflict');
   if(text.includes('unauthenticated_or_revoked'))throw new WorkspaceAuthError('UNAUTHENTICATED');
   if(['access_denied','admin_required','not_found_or_denied','eligible_teacher_required'].some(v=>text.includes(v)))throw new WorkspaceAuthError('ACCESS_DENIED');
   throw new WorkspaceFault('network_error');
  }
 }
 async invoke(token:string,name:WorkspaceRpcName,args:object,signal:AbortSignal):Promise<unknown>{
  if(!(name in order))throw new WorkspaceAuthError('ACCESS_DENIED');
  return this.query(token,name,order[name].map(k=>(args as Record<string,unknown>)[k]),signal);
 }
 async membership(token:string,schoolId:string,signal:AbortSignal):Promise<MembershipSnapshot>{
  return await this.query(token,'ws_c_membership_status',[schoolId],signal) as MembershipSnapshot;
 }
}
