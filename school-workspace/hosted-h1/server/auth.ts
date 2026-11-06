import {createClient,type SupabaseClient,type Session} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {AccountLoopback} from '../../../electron-p0/main/account-loopback.js';
import {Mutex,type SecretSession,type SecretVault} from '../../auth/server/ports.js';
import {validateSession} from '../../auth/server/session.js';
import {WorkspaceRequestScope} from '../../auth/common/rpc.js';
import type {WorkspaceAuthStatus} from '../../auth/common/types.js';
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
 async login(){if(this.disposed)throw new H1Error('CONFIGURATION');await this.logout();const g=this.reset();this.state={kind:'signing_in'};try{
  if(this.http.config.mode==='isolated-test'&&this.qaCredentials){const c=await this.qaCredentials();this.fresh(g);const{data,error}=await this.client.auth.signInWithPassword(c);if(error)throw new H1Error('AUTH');await this.commit(data.session,g);return;}
  if(this.http.config.mode!=='hosted-candidate')throw new H1Error('CONFIGURATION');
  this.loopback=new AccountLoopback();await new Promise<void>((resolve,reject)=>{
   this.cancelLogin=()=>reject(new H1Error('STALE'));
   void this.loopback!.start(value=>{if(value.error||!value.code){reject(new H1Error('AUTH'));return;}void this.client.auth.exchangeCodeForSession(value.code,{flowId:value.flowId}).then(async r=>{if(r.error)throw new H1Error('AUTH');await this.commit(r.data.session,g);resolve();}).catch(()=>reject(new H1Error('AUTH')));},()=>reject(new H1Error('AUTH'))).then(async redirect=>{
    const r=await this.client.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});this.fresh(g);if(r.error||!r.data.url||!r.data.flowId)throw new H1Error('AUTH');const u=new URL(r.data.url),back=new URL(u.searchParams.get('redirect_to')??'');if(u.origin!==this.http.config.origin||u.pathname!=='/auth/v1/authorize'||u.searchParams.get('provider')!=='google'||u.searchParams.get('code_challenge_method')!=='s256'||back.origin!==new URL(redirect).origin||back.pathname!==new URL(redirect).pathname)throw new H1Error('CONFIGURATION');this.loopback!.arm(r.data.flowId);await this.open(u.href);
   }).catch(()=>reject(new H1Error('AUTH')));
  });
 }catch(e){if(g===this.epoch){this.session=null;await this.storage.run(()=>this.vault.clear());this.state={kind:'error',error:'AUTH_SERVER_ERROR'};}throw e instanceof H1Error?e:new H1Error('AUTH');}finally{this.loopback?.close();this.cancelLogin=undefined;}}
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
