import{validateSchoolQuery}from'../../../electron-p0/school-protocol.js';
import{WorkspaceCoordinator}from'../../integration/core/workspace.js';
import{WorkspaceAuthError}from'../../auth/common/types.js';
import type{Action,SchoolState,SchoolBridge,SelfData,DirectorySchool,Transfer}from'./types.js';
export interface SchoolPort{workspace:WorkspaceCoordinator;call(name:string,args:object,signal:AbortSignal):Promise<unknown>;reauth():Promise<void>}
const empty=():SchoolState=>({workspace:{phase:'signed_out'},directory:[],self:{memberships:[],space_requests:[]},transfers:[]});
export class SchoolController implements SchoolBridge{
 #state=empty();#gen=0;#abort=new AbortController();#busy=false;
 constructor(readonly port:SchoolPort){}
 snapshot(){return structuredClone(this.#state);}
 private reset(){this.#gen++;this.#abort.abort();this.#abort=new AbortController();this.#state=empty();}
 async command(action:Action,input:Record<string,unknown>={}):Promise<SchoolState>{
  if(action==='logout'){this.reset();await this.port.workspace.logout();return this.snapshot();}
  if(action==='select'||action==='login'){const directory=action==='select'?this.#state.directory:[];this.reset();this.#state.directory=directory;}
  const g=this.#gen,signal=this.#abort.signal;const check=()=>{if(g!==this.#gen)throw new WorkspaceAuthError('STALE_RESPONSE');};
  const call=async<T>(name:string,args:object={}):Promise<T>=>{const v=await this.port.call(name,args,signal);check();return v as T;};
  // Serialize ordinary mutations in one session; server receipts/version/locks are authoritative across sessions.
  const mutation=!['state','login','search','select','refresh','reauth'].includes(action);
  if(mutation&&this.#busy)return{...this.snapshot(),notice:'처리 중입니다. 잠시 기다려 주세요.'};
  if(mutation)this.#busy=true;
  try{
   if(action==='login')await this.port.workspace.login();else await this.port.workspace.refreshAuth();check();
   this.#state.workspace=this.port.workspace.snapshot();
   if(['signed_out','expired_session','network_error'].includes(this.#state.workspace.phase)){this.#state={...empty(),workspace:this.#state.workspace};return this.snapshot();}
   let selected=action==='select'?String(input.school??''):this.#state.selected;
   if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))throw Error('input');
   if(action==='search'){const q=validateSchoolQuery({name:input.name,officeCode:input.office??''});this.#state.directory=await call<DirectorySchool[]>('ws_s02_directory',{q:q.name,o:q.officeCode});}
   const s=selected;
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
   if(action==='reauth')await this.port.reauth();check();
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
   else{if(e instanceof Error&&e.message==='network')this.#state.workspace={phase:'network_error'};this.#state.admin=undefined;this.#state.transfers=[];this.#state.notice=e instanceof WorkspaceAuthError?'접근 권한을 확인해 주세요.':e instanceof Error&&e.message==='conflict'?'이미 처리되었거나 정보가 변경되었습니다. 새로고침해 주세요.':e instanceof Error&&e.message==='reauth'?'관리자 변경 전에 다시 로그인해 주세요.':e instanceof Error&&e.message==='input'?'입력한 역할·기간을 확인해 주세요.':'연결을 확인하고 다시 시도해 주세요.';}
  }finally{if(mutation)this.#busy=false;}
  return this.snapshot();
 }
}
