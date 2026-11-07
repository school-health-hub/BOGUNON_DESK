import{validateSchoolQuery}from'../../../electron-p0/school-protocol.js';
import{WorkspaceCoordinator}from'../../integration/core/workspace.js';
import{WorkspaceAuthError,type WorkspaceMembershipContext}from'../../auth/common/types.js';
import type{Action,SchoolState,SchoolBridge,SelfData,DirectorySchool,Transfer}from'./types.js';
export interface SchoolPort{workspace:WorkspaceCoordinator;call(name:string,args:object,signal:AbortSignal):Promise<unknown>;reauthenticate?(signal:AbortSignal):Promise<'verified'|'cancelled'|'failed'>}
const empty=():SchoolState=>({workspace:{phase:'signed_out'},directory:[],self:{memberships:[],space_requests:[]},transfers:[]});
export class SchoolController implements SchoolBridge{
 #state=empty();#gen=0;#abort=new AbortController();#busy=false;
 #adminProof?:{context:WorkspaceMembershipContext;expiresAt:number};
 constructor(readonly port:SchoolPort){}
 private matchesContext(context:WorkspaceMembershipContext){
  const current=this.#state.workspace.context;
  return this.#state.workspace.phase==='approved'&&current?.schoolId===context.schoolId&&current.memberCode===context.memberCode&&current.epoch===context.epoch&&current.role===context.role;
 }
 private hasAdminProof(){
  return !!this.#adminProof&&Date.now()<this.#adminProof.expiresAt&&this.matchesContext(this.#adminProof.context);
 }
 snapshot():SchoolState{
  return structuredClone({...this.#state,adminReauth:!this.port.reauthenticate?'unsupported':this.hasAdminProof()?'verified':'required'});
 }
 private reset(){this.#adminProof=undefined;this.#gen++;this.#abort.abort();this.#abort=new AbortController();this.#state=empty();}
 async command(action:Action,input:Record<string,unknown>={}):Promise<SchoolState>{
  if(action==='logout'){this.reset();await this.port.workspace.logout();return this.snapshot();}
  if(action==='select'||action==='login'){const directory=action==='select'?this.#state.directory:[];this.reset();this.#state.directory=directory;}
  const g=this.#gen,signal=this.#abort.signal;const check=()=>{if(g!==this.#gen)throw new WorkspaceAuthError('STALE_RESPONSE');};
  const call=async<T>(name:string,args:object={}):Promise<T>=>{const v=await this.port.call(name,args,signal);check();return v as T;};
  // Serialize ordinary mutations in one session; server receipts/version/locks are authoritative across sessions.
  const mutation=!['state','login','search','select','refresh','reauth'].includes(action);
  const locked=mutation||action==='reauth';
  if(locked&&this.#busy)return{...this.snapshot(),notice:'처리 중입니다. 잠시 기다려 주세요.'};
  if(locked)this.#busy=true;
  this.#state.reauthNotice=undefined;
  try{
   if(action==='login')await this.port.workspace.login();else await this.port.workspace.refreshAuth();check();
   this.#state.workspace=this.port.workspace.snapshot();
   if(!this.hasAdminProof())this.#adminProof=undefined;
   if(['signed_out','expired_session','network_error'].includes(this.#state.workspace.phase)){this.#state={...empty(),workspace:this.#state.workspace};return this.snapshot();}
   let selected=action==='select'?String(input.school??''):this.#state.selected;
   if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))throw Error('input');
   if(action==='search'){const q=validateSchoolQuery({name:input.name,officeCode:input.office??''});this.#state.directory=await call<DirectorySchool[]>('ws_s02_directory',{q:q.name,o:q.officeCode});}
   const s=selected;
   const adminChange=action==='propose'||action==='accept';
   if(action==='reauth'||adminChange){
    const {context,phase}=this.#state.workspace;
    if(!this.port.reauthenticate){
     this.#state.notice='이 연결에서는 관리자 재인증을 지원하지 않습니다.';
     return this.snapshot();
    }
    if(phase!=='approved'||!s||context?.schoolId!==s||context.role==='HEALTH_ASSISTANT'||(action==='propose'&&context.role!=='SCHOOL_ADMIN')||(action==='accept'&&context.role!=='HEALTH_TEACHER')){
     if(phase!=='approved')this.#state={...empty(),workspace:this.#state.workspace};
     this.#state.notice='현재 학교의 관리자 변경 권한을 확인해 주세요.';
     return this.snapshot();
    }
    if(action==='reauth'){
     this.#adminProof=undefined;
     const result=await this.port.reauthenticate(signal);check();
     await this.port.workspace.refreshAuth();check();
     this.#state.workspace=this.port.workspace.snapshot();
     if(this.#state.workspace.phase==='expired_session'||this.#state.workspace.phase==='signed_out')throw new WorkspaceAuthError('UNAUTHENTICATED');
     if(!this.matchesContext(context)){
      this.#state={...empty(),workspace:this.#state.workspace,notice:'학교 또는 계정이 바뀌었거나 연결이 끊겼습니다. 다시 확인해 주세요.'};
      return this.snapshot();
     }
     if(result==='verified')this.#adminProof={context,expiresAt:Date.now()+10*60_000};
     this.#state.notice=undefined;
     this.#state.reauthNotice=result==='verified'?undefined:result==='cancelled'?'재인증을 취소했습니다.':'재인증에 실패했습니다. 다시 시도해 주세요.';
     return this.snapshot();
    }
    if(!this.hasAdminProof()){
     this.#state.notice='관리자 변경 전에 다시 로그인하는 재인증 절차를 완료해 주세요.';
     return this.snapshot();
    }
    this.#adminProof=undefined;
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
   if(action==='propose')await call('ws_v1_propose_admin_change',{p_school_id:s,p_target_membership_id:str('id'),p_mode:str('mode'),p_request_id:id()});
   if(action==='accept')await call('ws_v1_accept_admin_change',{p_school_id:s,p_transfer_id:str('id'),p_expected_version:ver(),p_request_id:id()});
   check();
   this.#state.self=await call<SelfData>('ws_s02_self');this.#state.selected=selected;
   if(selected){await this.port.workspace.selectSchool(selected);check();this.#state.workspace=this.port.workspace.snapshot();
    this.#state.admin=undefined;this.#state.transfers=[];
    if(this.#state.workspace.phase==='approved'){
     this.#state.transfers=await call<Transfer[]>('ws_s02_transfers',{s:selected});
     if(this.#state.workspace.context?.role==='SCHOOL_ADMIN')this.#state.admin=await call('ws_s02_admin',{s:selected});
    }
   }
   this.#state.notice=mutation?'서버에서 처리 결과를 확인했습니다.':undefined;
  }catch(e){
   if(g!==this.#gen)return this.snapshot();
   if(e instanceof WorkspaceAuthError&&e.code==='UNAUTHENTICATED'){this.reset();this.#state.workspace={phase:'expired_session'};}
   else if(action==='reauth'){this.#state.notice=undefined;this.#state.reauthNotice=e instanceof WorkspaceAuthError&&e.code==='AUTH_CANCELLED'?'재인증을 취소했습니다.':'재인증에 실패했습니다. 다시 시도해 주세요.';}
   else{if(e instanceof Error&&e.message==='network')this.#state.workspace={phase:'network_error'};this.#state.admin=undefined;this.#state.transfers=[];this.#state.notice=e instanceof WorkspaceAuthError?'접근 권한을 확인해 주세요.':e instanceof Error&&e.message==='conflict'?'이미 처리되었거나 정보가 변경되었습니다. 새로고침해 주세요.':e instanceof Error&&e.message==='reauth'?'관리자 변경 전에 다시 로그인해 주세요.':e instanceof Error&&e.message==='input'?'입력한 역할·기간을 확인해 주세요.':'연결을 확인하고 다시 시도해 주세요.';}
  }finally{if(locked)this.#busy=false;}
  return this.snapshot();
 }
}
