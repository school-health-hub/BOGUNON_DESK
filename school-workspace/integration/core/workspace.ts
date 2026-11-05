import type { WorkspaceAuthStatus, WorkspaceMembershipContext } from '../../auth/common/types.js';
import { WorkspaceAuthError } from '../../auth/common/types.js';
import type { WorkspaceRpcContracts, WorkspaceRpcName } from '../../auth/common/rpc.js';
export type WorkspacePhase = 'signed_out'|'signing_in'|'authenticated_unselected'|'pending'|'approved'|'suspended'|'expired_membership'|'recovery_locked'|'expired_session'|'network_error'|'access_denied'|'conflict';
export class WorkspaceFault extends Error { constructor(readonly kind:Exclude<WorkspacePhase,'signed_out'|'signing_in'|'authenticated_unselected'|'approved'>) { super(kind); } }
export interface MembershipSnapshot { status:'active'|'pending'|'suspended'|'expired_membership'|'recovery_locked'|'access_denied' }
export interface IntegratedWorkspacePort {
  authStatus():Promise<WorkspaceAuthStatus>; login():Promise<void>; logout():Promise<void>; invalidate():void;
  bootstrap(signal:AbortSignal):Promise<{actor_id:string}>;
  membership(schoolId:string,signal:AbortSignal):Promise<MembershipSnapshot>;
  context(schoolId:string,signal:AbortSignal):Promise<WorkspaceMembershipContext>;
  rpc<N extends WorkspaceRpcName>(name:N,args:WorkspaceRpcContracts[N]['args'],signal:AbortSignal):Promise<WorkspaceRpcContracts[N]['result']>;
}
export interface WorkspaceViewState { phase:WorkspacePhase; schoolId?:string; context?:WorkspaceMembershipContext }
export class WorkspaceCoordinator {
  #state:Readonly<WorkspaceViewState>=Object.freeze({phase:'signed_out'});
  #generation=0; #abort=new AbortController(); #listeners=new Set<()=>void>();
  #lastUser:string|null=null;
  constructor(private readonly port:IntegratedWorkspacePort){}
  snapshot=():Readonly<WorkspaceViewState>=>this.#state;
  subscribe=(fn:()=>void):(()=>void)=>{this.#listeners.add(fn);return()=>{this.#listeners.delete(fn);};};
  private set(v:WorkspaceViewState):void {this.#state=Object.freeze(v);for(const fn of this.#listeners)fn();}
  private reset():number {this.#generation++;this.#abort.abort();this.#abort=new AbortController();this.port.invalidate();return this.#generation;}
  private current(g:number):void {if(g!==this.#generation)throw new WorkspaceAuthError('STALE_RESPONSE');}
  private fail(e:unknown,g:number,schoolId?:string):void {
    if(g!==this.#generation)return;
    this.#abort.abort();this.port.invalidate();
    let phase:WorkspacePhase='network_error';
    if(e instanceof WorkspaceFault)phase=e.kind;
    else if(e instanceof WorkspaceAuthError) {
      if(e.code==='STALE_RESPONSE')return;
      phase=e.code==='UNAUTHENTICATED'?'expired_session':e.code==='ACCESS_DENIED'?'access_denied':'network_error';
    }
    this.set({phase,schoolId});
  }
  async login():Promise<void>{
    const g=this.reset();this.#lastUser=null;this.set({phase:'signing_in'});
    try{await this.port.login();this.current(g);await this.finishAuthentication(g);}catch(e){this.fail(e,g);}
  }
  async refreshAuth():Promise<void>{
    let g=this.#generation;
    try{
      const s=await this.port.authStatus();this.current(g);
      if(s.kind!=='authenticated') {
        this.reset();this.#lastUser=null;this.set({phase:s.kind==='expired'?'expired_session':s.kind==='signing_in'?'signing_in':s.kind==='error'?'network_error':'signed_out'});return;
      }
      if(this.#lastUser!==s.session.user.id){const next=this.reset();g=next;this.#lastUser=s.session.user.id;await this.port.bootstrap(this.#abort.signal);this.current(next);this.set({phase:'authenticated_unselected'});}
    }catch(e){this.fail(e,g);}
  }
  private async finishAuthentication(g:number):Promise<void>{
    const s=await this.port.authStatus();this.current(g);
    if(s.kind!=='authenticated')throw new WorkspaceAuthError('UNAUTHENTICATED');
    this.#lastUser=s.session.user.id;await this.port.bootstrap(this.#abort.signal);this.current(g);this.set({phase:'authenticated_unselected'});
  }
  async selectSchool(schoolId:string):Promise<void>{
    const g=this.reset();this.set({phase:'authenticated_unselected',schoolId});
    try{
      const s=await this.port.authStatus();this.current(g);
      if(s.kind!=='authenticated')throw new WorkspaceAuthError('UNAUTHENTICATED');
      if(this.#lastUser!==s.session.user.id){this.#lastUser=s.session.user.id;await this.port.bootstrap(this.#abort.signal);this.current(g);}
      const m=await this.port.membership(schoolId,this.#abort.signal);this.current(g);
      if(m.status!=='active'){this.set({phase:m.status,schoolId});return;}
      const context=await this.port.context(schoolId,this.#abort.signal);this.current(g);
      if(context.schoolId!==schoolId)throw new WorkspaceAuthError('ACCESS_DENIED');
      this.set({phase:'approved',schoolId,context});
    }catch(e){this.fail(e,g,schoolId);}
  }
  async request<N extends WorkspaceRpcName>(name:N,args:WorkspaceRpcContracts[N]['args']):Promise<WorkspaceRpcContracts[N]['result']>{
    const g=this.#generation,school=this.#state.schoolId;
    if(this.#state.phase!=='approved'||!school)throw new WorkspaceAuthError('ACCESS_DENIED');
    if('p_school_id'in args&&args.p_school_id!==school)throw new WorkspaceAuthError('ACCESS_DENIED');
    try{
      const status=await this.port.authStatus();this.current(g);
      if(status.kind!=='authenticated')throw new WorkspaceAuthError('UNAUTHENTICATED');
      if(status.session.user.id!==this.#lastUser){this.reset();this.#lastUser=null;this.set({phase:'authenticated_unselected'});throw new WorkspaceAuthError('STALE_RESPONSE');}
      // Always revalidate current DB membership and effective context; UI cache is not authorization.
      const m=await this.port.membership(school,this.#abort.signal);this.current(g);
      if(m.status!=='active')throw new WorkspaceFault(m.status);
      const context=await this.port.context(school,this.#abort.signal);this.current(g);
      const value=await this.port.rpc(name,args,this.#abort.signal);this.current(g);
      this.set({phase:'approved',schoolId:school,context});return value;
    }catch(e){this.fail(e,g,school);throw e;}
  }
  async logout():Promise<void>{
    const g=this.reset();this.#lastUser=null;this.set({phase:'signed_out'});
    try{await this.port.logout();this.current(g);}catch(e){this.fail(e,g);}
  }
}
