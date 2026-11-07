import {createClient,type SupabaseClient,type Session} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {AccountLoopback} from '../../../electron-p0/main/account-loopback.js';
import {Mutex,type SecretSession,type SecretVault} from '../../auth/server/ports.js';
import {validateSession} from '../../auth/server/session.js';
import {WorkspaceRequestScope} from '../../auth/common/rpc.js';
import {WorkspaceAuthError,type WorkspaceAuthStatus} from '../../auth/common/types.js';
import {H1Error,H1Http} from './http.js';
export class H1Auth{
 readonly scope=new WorkspaceRequestScope();private client:SupabaseClient;private values=new Map<string,string>();private session:SecretSession|null=null;private epoch=0;private disposed=false;private storage=new Mutex();private refreshJob?:Promise<void>;private loopback?:AccountLoopback;private cancelLogin?:()=>void;private state:WorkspaceAuthStatus={kind:'signed_out'};
 constructor(readonly http:H1Http,private vault:SecretVault,private open:(url:string)=>Promise<void>,private qaCredentials?:()=>Promise<{email:string;password:string}>){
  this.client=createClient(http.config.origin,http.config.publicKey,{global:{fetch:http.fetch},auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce',experimental:{appendPkceFlowIdToRedirects:true},debug:false,storageKey:'school-h1-private',storage:{getItem:k=>this.values.get(k)??null,setItem:(k,v)=>{this.values.set(k,v);},removeItem:k=>{this.values.delete(k);}}}});
 }
 private fresh(g:number){if(this.disposed||g!==this.epoch)throw new H1Error('STALE');}
 private reset(){this.scope.invalidate();this.http.abortPending();this.cancelLogin?.();this.cancelLogin=undefined;this.loopback?.close();this.loopback=undefined;return ++this.epoch;}
 private async verify(s:SecretSession){const{data,error}=await this.client.auth.getUser(s.accessToken);if(error)throw new H1Error(error.status===0||error.status&&error.status>=500?'NETWORK':'AUTH');if(!data.user||data.user.id!==s.userId||data.user.is_anonymous===true)throw new H1Error('AUTH');}
 private async commit(s:Session|null,g:number){if(!s)throw new H1Error('AUTH');const next=validateSession({userId:s.user.id,accessToken:s.access_token,refreshToken:s.refresh_token,expiresAt:(s.expires_at??0)*1000});await this.verify(next);this.fresh(g);await this.storage.run(async()=>{this.fresh(g);await this.vault.save(next);if(g!==this.epoch){await this.vault.clear();throw new H1Error('STALE');}});this.fresh(g);this.session=next;this.state={kind:'authenticated',session:{user:{id:next.userId},expiresAt:next.expiresAt}};}
 private async googleLogin(g:number,signal?:AbortSignal){
  const loopback=new AccountLoopback();
  this.loopback=loopback;
  const check=()=>{this.fresh(g);if(signal?.aborted)throw new H1Error('STALE');};
  let abort:()=>void=()=>{};
  try{
   await new Promise<void>((resolve,reject)=>{
    abort=()=>reject(new H1Error('STALE'));
    this.cancelLogin=abort;
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    void loopback.start(value=>{
     if(value.cancelled){reject(new WorkspaceAuthError('AUTH_CANCELLED'));return;}
     if(value.error||!value.code){reject(new H1Error('AUTH'));return;}
     const code=value.code;
     void (async()=>{
      check();
      const result=await this.client.auth.exchangeCodeForSession(code,{flowId:value.flowId});
      check();
      if(result.error)throw new H1Error('AUTH');
      await this.commit(result.data.session,g);
     })().then(resolve,reject);
    },()=>reject(new WorkspaceAuthError('FLOW_EXPIRED'))).then(async redirect=>{
     check();
     const result=await this.client.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
     check();
     if(result.error||!result.data.url||!result.data.flowId)throw new H1Error('AUTH');
     const url=new URL(result.data.url),back=new URL(url.searchParams.get('redirect_to')??''),expected=new URL(redirect);
     if(url.origin!==this.http.config.origin||url.pathname!=='/auth/v1/authorize'||url.searchParams.get('provider')!=='google'||url.searchParams.get('code_challenge_method')!=='s256'||back.origin!==expected.origin||back.pathname!==expected.pathname||back.searchParams.get('sb_flow_id')!==result.data.flowId)throw new H1Error('CONFIGURATION');
     loopback.arm(result.data.flowId);
     await this.open(url.href);
    }).catch(reject);
   });
  }finally{
   signal?.removeEventListener('abort',abort);
   loopback.close();
   if(this.loopback===loopback){this.loopback=undefined;this.cancelLogin=undefined;}
  }
 }
 async login(signal?:AbortSignal){
  if(this.disposed)throw new H1Error('CONFIGURATION');
  if(signal?.aborted)throw new H1Error('STALE');
  const signOut=this.logout(),previous=this.epoch;
  await signOut;
  this.fresh(previous);
  if(signal?.aborted)throw new H1Error('STALE');
  const g=this.reset();this.state={kind:'signing_in'};
  try{
   if(this.http.config.mode==='isolated-test'&&this.qaCredentials){
    const c=await this.qaCredentials();this.fresh(g);
    const{data,error}=await this.client.auth.signInWithPassword(c);
    if(signal?.aborted)throw new H1Error('STALE');
    if(error)throw new H1Error('AUTH');
    await this.commit(data.session,g);
   }else if(this.http.config.mode==='hosted-candidate')await this.googleLogin(g,signal);
   else throw new H1Error('CONFIGURATION');
   if(signal?.aborted)throw new H1Error('STALE');
  }catch(e){
   if(g===this.epoch){
    const failed=this.reset();
    this.session=null;this.values.clear();
    this.state=signal?.aborted?{kind:'signed_out'}:{kind:'error',error:e instanceof WorkspaceAuthError?e.code:'AUTH_SERVER_ERROR'};
    await this.storage.run(async()=>{if(failed===this.epoch)await this.vault.clear();});
   }
   throw e instanceof H1Error||e instanceof WorkspaceAuthError?e:new H1Error('AUTH');
  }
 }
 async restore(){const g=this.reset();this.session=null;this.state={kind:'signed_out'};try{const s=await this.storage.run(()=>this.vault.load());this.fresh(g);if(!s)return;this.session=validateSession(s);await this.ensure();this.fresh(g);}catch{if(g===this.epoch){this.session=null;this.state={kind:'expired'};await this.storage.run(()=>this.vault.clear());}}}
 private async ensure(){const g=this.epoch;try{await this.ensureSession();}catch(e){if(!this.disposed&&g===this.epoch&&e instanceof H1Error&&e.code==='AUTH'){const dead=this.reset();this.session=null;this.state={kind:'expired'};this.values.clear();await this.storage.run(async()=>{if(dead===this.epoch)await this.vault.clear();});}throw e;}}
 private async ensureSession(){if(this.disposed||!this.session)throw new H1Error('AUTH');const g=this.epoch;
  if(this.session.expiresAt<=Date.now()+30000){if(!this.refreshJob)this.refreshJob=(async()=>{const old=this.session!;const{data,error}=await this.client.auth.refreshSession({refresh_token:old.refreshToken});this.fresh(g);if(error||data.session?.user.id!==old.userId)throw new H1Error('AUTH');await this.commit(data.session,g);})().finally(()=>{this.refreshJob=undefined;});await this.refreshJob;}
  await this.verify(this.session!);this.fresh(g);this.state={kind:'authenticated',session:{user:{id:this.session!.userId},expiresAt:this.session!.expiresAt}};
 }
 async status():Promise<WorkspaceAuthStatus>{const g=this.epoch;if(this.session)try{await this.ensure();}catch(e){if(g===this.epoch){this.scope.invalidate();this.state=e instanceof H1Error&&e.code==='NETWORK'?{kind:'error',error:'AUTH_SERVER_ERROR'}:{kind:'expired'};}}return structuredClone(this.state);}
 async authorized<T>(fn:(token:string,signal:AbortSignal)=>Promise<T>){const g=this.epoch;await this.ensure();this.fresh(g);return this.scope.run(signal=>fn(this.session!.accessToken,signal));}
 async logout(){const old=this.session,g=this.reset();this.session=null;this.values.clear();this.state={kind:'signed_out'};await this.storage.run(()=>this.vault.clear());let unconfirmed=false;
  if(old){try{await this.http.rpc(old.accessToken,'ws_v1_revoke_current_session',{p_request_id:randomUUID()},AbortSignal.timeout(10000));}catch{unconfirmed=true;}
   try{const r=await this.http.fetch(`${this.http.config.origin}/auth/v1/logout?scope=local`,{method:'POST',headers:{Authorization:`Bearer ${old.accessToken}`}});if(!r.ok)unconfirmed=true;}catch{unconfirmed=true;}}
  if(g===this.epoch&&unconfirmed)this.state={kind:'signed_out',remoteRevocation:'unconfirmed'};
 }
 async dispose(){if(this.disposed)return;this.disposed=true;this.reset();this.session=null;this.state={kind:'signed_out'};this.values.clear();await this.http.drain();this.client.auth.dispose();}
}
