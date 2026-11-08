import{validateSchoolQuery}from'../../../electron-p0/school-protocol.js';
import{WorkspaceCoordinator}from'../../integration/core/workspace.js';
import{WorkspaceAuthError,type WorkspaceMembershipContext}from'../../auth/common/types.js';
import type{Action,SchoolState,SchoolBridge,SelfData,DirectorySchool,Transfer}from'./types.js';
export type AdminMfaAttempt=Readonly<{intentId:string;factorId:string;schoolId:string;purpose:'propose'|'accept';expiresAt:number}>;
export interface SchoolAdminMfaPort{
 start(input:Readonly<{schoolId:string;purpose:'propose'|'accept';targetId:string;mode?:string;version?:number}>,signal:AbortSignal):Promise<AdminMfaAttempt>;
 verify(attempt:AdminMfaAttempt,code:string,signal:AbortSignal):Promise<Readonly<{verified:true}>>;
 execute(attempt:AdminMfaAttempt,signal:AbortSignal):Promise<void>;
 cancel(attempt:AdminMfaAttempt,signal:AbortSignal):Promise<void>;
}
export interface SchoolPort{workspace:WorkspaceCoordinator;call(name:string,args:object,signal:AbortSignal):Promise<unknown>;adminMfa?:SchoolAdminMfaPort}
const empty=():SchoolState=>({workspace:{phase:'signed_out'},directory:[],self:{memberships:[],space_requests:[]},transfers:[]});
export class SchoolController implements SchoolBridge{
 #state=empty();#gen=0;#abort=new AbortController();#busy=false;
 #adminAttempt:{attempt:AdminMfaAttempt;context:WorkspaceMembershipContext}|undefined;
 constructor(readonly port:SchoolPort){}
 private matchesContext(context:WorkspaceMembershipContext){
  const current=this.#state.workspace.context;
  return this.#state.workspace.phase==='approved'&&current?.schoolId===context.schoolId&&current.memberCode===context.memberCode&&current.epoch===context.epoch&&current.role===context.role;
 }
 snapshot():SchoolState{
  const adminMfa=!this.port.adminMfa?{status:'unsupported' as const}:this.#adminAttempt?{status:'challenge' as const,purpose:this.#adminAttempt.attempt.purpose,expiresAt:this.#adminAttempt.attempt.expiresAt}:{status:'ready' as const};
  return structuredClone({...this.#state,adminMfa});
 }
 private reset(){this.#adminAttempt=undefined;this.#gen++;this.#abort.abort();this.#abort=new AbortController();this.#state=empty();}
 private async cancelAttempt(){
  const pending=this.#adminAttempt;this.#adminAttempt=undefined;
  if(!pending||!this.port.adminMfa)return;
  try{await this.port.adminMfa.cancel(pending.attempt,AbortSignal.timeout(10_000));}catch(error){if(!(error instanceof Error))throw error;}
 }
 async command(action:Action,input:Record<string,unknown>={}):Promise<SchoolState>{
  if(action==='logout'){await this.cancelAttempt();this.reset();await this.port.workspace.logout();return this.snapshot();}
  if(action==='select'||action==='login'){const directory=action==='select'?this.#state.directory:[];await this.cancelAttempt();this.reset();this.#state.directory=directory;}
  const g=this.#gen,signal=this.#abort.signal;const check=()=>{if(g!==this.#gen)throw new WorkspaceAuthError('STALE_RESPONSE');};
  const call=async<T>(name:string,args:object={}):Promise<T>=>{const v=await this.port.call(name,args,signal);check();return v as T;};
  // Serialize ordinary mutations in one session; server receipts/version/locks are authoritative across sessions.
  const mutation=!['state','login','search','select','refresh','mfaVerify','mfaCancel'].includes(action);
  const locked=mutation||action==='mfaVerify'||action==='mfaCancel';
  if(locked&&this.#busy)return{...this.snapshot(),notice:'처리 중입니다. 잠시 기다려 주세요.'};
  if(locked)this.#busy=true;
  delete this.#state.reauthNotice;
  try{
   if(action==='login')await this.port.workspace.login();else await this.port.workspace.refreshAuth();check();
   this.#state.workspace=this.port.workspace.snapshot();
   if(this.#adminAttempt&&(!this.matchesContext(this.#adminAttempt.context)||Date.now()>=this.#adminAttempt.attempt.expiresAt))await this.cancelAttempt();
   const loginIssue=this.#state.workspace.loginIssue;
   if(action==='login'&&loginIssue){
    const notice=loginIssue==='AUTH_CANCELLED'?'공동 계정 로그인을 취소했습니다.':loginIssue==='FLOW_EXPIRED'?'로그인 시간이 초과되었습니다. 다시 시작해 주세요.':'공동 계정 로그인에 실패했습니다. 다시 시도해 주세요.';
    this.#state={...empty(),workspace:this.#state.workspace,notice};
    return this.snapshot();
   }
   if(['signed_out','expired_session','network_error'].includes(this.#state.workspace.phase)){this.#state={...empty(),workspace:this.#state.workspace};return this.snapshot();}
   let selected=action==='select'?String(input.school??''):this.#state.selected;
   if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))throw Error('input');
   if(action==='search'){const q=validateSchoolQuery({name:input.name,officeCode:input.office??''});this.#state.directory=await call<DirectorySchool[]>('ws_s02_directory',{q:q.name,o:q.officeCode});}
   const s=selected;
   const adminChange=action==='propose'||action==='accept';
   if(adminChange||action==='mfaVerify'||action==='mfaCancel'){
    const {context,phase}=this.#state.workspace;
    if(!this.port.adminMfa){
     this.#state.notice='신뢰할 수 있는 관리자 MFA 서버를 지원하지 않는 연결입니다.';
     return this.snapshot();
    }
    if(phase!=='approved'||!s||!context||context.schoolId!==s||context.role==='HEALTH_ASSISTANT'||(action==='propose'&&context.role!=='SCHOOL_ADMIN')||(action==='accept'&&context.role!=='HEALTH_TEACHER')){
     if(phase!=='approved')this.#state={...empty(),workspace:this.#state.workspace};
     this.#state.notice='현재 학교의 관리자 변경 권한을 확인해 주세요.';
     return this.snapshot();
    }
    if(action==='mfaCancel'){
     await this.cancelAttempt();check();this.#state.reauthNotice='관리자 MFA 인증을 취소했습니다.';return this.snapshot();
    }
    if(action==='mfaVerify'){
     const pending=this.#adminAttempt,code=typeof input.code==='string'?input.code:'';
     if(!pending||!/^\d{6}$/.test(code)){this.#state.reauthNotice='인증번호 6자리를 확인해 주세요.';return this.snapshot();}
     if(Date.now()>=pending.attempt.expiresAt){await this.cancelAttempt();this.#state.reauthNotice='관리자 MFA 인증 시간이 만료되었습니다. 다시 시작해 주세요.';return this.snapshot();}
     try{
      const verified=await this.port.adminMfa.verify(pending.attempt,code,signal);check();
      if(verified.verified!==true||this.#adminAttempt!==pending||!this.matchesContext(pending.context))throw new WorkspaceAuthError('STALE_RESPONSE');
      await this.port.adminMfa.execute(pending.attempt,signal);check();this.#adminAttempt=undefined;
      this.#state.self=await call<SelfData>('ws_s02_self');this.#state.selected=s;
      await this.port.workspace.selectSchool(s);check();this.#state.workspace=this.port.workspace.snapshot();delete this.#state.admin;this.#state.transfers=[];
      if(this.#state.workspace.phase==='approved'){
       this.#state.transfers=await call<Transfer[]>('ws_s02_transfers',{s});
       if(this.#state.workspace.context?.role==='SCHOOL_ADMIN')this.#state.admin=await call('ws_s02_admin',{s});
      }
     this.#state.notice='서버에서 관리자 변경 결과를 확인했습니다.';
     }catch(error){
      if(this.#adminAttempt===pending)await this.cancelAttempt();
      if(error instanceof WorkspaceAuthError)throw error;
      this.#state.reauthNotice='관리자 MFA 인증에 실패했습니다. 다시 시도해 주세요.';
     }
     return this.snapshot();
    }
    if(this.#adminAttempt){this.#state.notice='진행 중인 관리자 MFA 인증을 먼저 완료하거나 취소해 주세요.';return this.snapshot();}
    const targetId=typeof input.id==='string'?input.id:'';
    const startInput={schoolId:s,purpose:action,targetId,...(action==='propose'?{mode:typeof input.mode==='string'?input.mode:''}:{version:Number(input.version)})};
    const attempt=await this.port.adminMfa.start(startInput,signal);check();
    if(attempt.schoolId!==s||attempt.purpose!==action){
     await this.port.adminMfa.cancel(attempt,signal);throw new WorkspaceAuthError('STALE_RESPONSE');
    }
    if(attempt.expiresAt<=Date.now()){
     await this.port.adminMfa.cancel(attempt,signal);this.#state.reauthNotice='관리자 MFA 인증 시간이 만료되었습니다. 다시 시작해 주세요.';return this.snapshot();
    }
    this.#adminAttempt={attempt,context};delete this.#state.notice;return this.snapshot();
   }
   const id=()=>crypto.randomUUID();
   const str=(k:string)=>{const v=input[k];if(typeof v!=='string'||v.length>100)throw Error('input');return v;};
   const ver=()=>{if(!Number.isSafeInteger(input.version)||Number(input.version)<1)throw Error('input');return Number(input.version);};
   if(mutation&&!s)throw Error('input');
   if(action==='join')await call('ws_v1_request_join',{p_school_id:s,p_requested_role:str('role'),p_request_id:id()});
   if(action==='space')await call('ws_s02_space',{s,r:id()});
   if(action==='withdraw')await call('ws_s02_withdraw',{s,j:str('id'),ev:ver(),r:id()});
   if(action==='decide')await call('ws_v1_decide_join',{p_school_id:s,p_join_request_id:str('id'),p_decision:str('decision'),p_approved_role:input.decision==='approve'?str('role'):null,p_valid_until:input.until||null,p_expected_version:ver(),p_request_id:id()});
   if(action==='role')await call('ws_v1_set_member_role',{p_school_id:s,p_membership_id:str('id'),p_new_role:str('role'),p_expected_version:ver(),p_request_id:id()});
   if(action==='membership')await call('ws_v1_set_membership_state',{p_school_id:s,p_membership_id:str('id'),p_state:str('state'),p_expected_version:ver(),p_request_id:id()});
   if(action==='expiry')await call('ws_s02_expiry',{s,mid:str('id'),until_at:str('until'),ev:ver(),r:id()});
   if(action==='leave')await call('ws_v1_leave_school',{p_school_id:s,p_expected_version:ver(),p_request_id:id()});
   check();
   this.#state.self=await call<SelfData>('ws_s02_self');if(selected)this.#state.selected=selected;else delete this.#state.selected;
   if(selected){await this.port.workspace.selectSchool(selected);check();this.#state.workspace=this.port.workspace.snapshot();
    delete this.#state.admin;this.#state.transfers=[];
    if(this.#state.workspace.phase==='approved'){
     this.#state.transfers=await call<Transfer[]>('ws_s02_transfers',{s:selected});
     if(this.#state.workspace.context?.role==='SCHOOL_ADMIN')this.#state.admin=await call('ws_s02_admin',{s:selected});
    }
   }
   if(mutation)this.#state.notice='서버에서 처리 결과를 확인했습니다.';else delete this.#state.notice;
  }catch(e){
   if(g!==this.#gen)return this.snapshot();
   if(e instanceof WorkspaceAuthError&&e.code==='UNAUTHENTICATED'){this.reset();this.#state.workspace={phase:'expired_session'};}
   else if(action==='mfaVerify'||action==='mfaCancel'||action==='propose'||action==='accept'){delete this.#state.notice;this.#state.reauthNotice=e instanceof WorkspaceAuthError&&e.code==='AUTH_CANCELLED'?'관리자 MFA 인증을 취소했습니다.':'관리자 MFA 인증에 실패했습니다. 다시 시도해 주세요.';}
   else{if(e instanceof Error&&e.message==='network')this.#state.workspace={phase:'network_error'};delete this.#state.admin;this.#state.transfers=[];this.#state.notice=e instanceof WorkspaceAuthError?'접근 권한을 확인해 주세요.':e instanceof Error&&e.message==='conflict'?'이미 처리되었거나 정보가 변경되었습니다. 새로고침해 주세요.':e instanceof Error&&e.message==='reauth'?'관리자 변경 전에 다시 로그인해 주세요.':e instanceof Error&&e.message==='input'?'입력한 역할·기간을 확인해 주세요.':'연결을 확인하고 다시 시도해 주세요.';}
  }finally{if(locked)this.#busy=false;}
  return this.snapshot();
 }
}
