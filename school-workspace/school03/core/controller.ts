import{TaskFault,type TaskAction,type TaskBridge,type TaskState,type Board,type Task,type History,type Contracts}from'./types.js';
import type{SchoolState}from'../../school02/core/types.js';import{WorkspaceAuthError}from'../../auth/common/types.js';
export interface TaskPort{school(action:'select'|'refresh',input?:Record<string,unknown>):Promise<SchoolState>;call<N extends keyof Contracts>(name:N,args:Contracts[N],signal:AbortSignal):Promise<unknown>}
export const emptyTaskState=():TaskState=>({phase:'locked',status:'',sort:'DUE',scope:'ALL',archives:false});
export class TaskController implements TaskBridge{
 #state=emptyTaskState();#generation=0;#abort=new AbortController();#busy=false;
 constructor(readonly port:TaskPort){}
 invalidate(){this.#generation++;this.#abort.abort();this.#abort=new AbortController();this.#state=emptyTaskState();}
 snapshot(){return structuredClone(this.#state);}
 async command(action:TaskAction,input:Record<string,unknown>={}):Promise<TaskState>{
  if(action!=='select'&&input.school&&input.school!==this.#state.school_id)return{...emptyTaskState(),notice:'학교를 다시 선택해 주세요.',notice_kind:'error'};
  if(action==='select')this.invalidate();const write=['create','edit','assign','status','close'].includes(action);if(this.#busy&&write)return{...this.snapshot(),notice:'처리 중입니다. 잠시 기다려 주세요.',notice_kind:'error'};
  const g=this.#generation,signal=this.#abort.signal,check=()=>{if(g!==this.#generation)throw new TaskFault('STALE');};
  if(write)this.#busy=true;
  const call=async<N extends keyof Contracts>(name:N,args:Contracts[N])=>{const v=await this.port.call(name,args,signal);check();return v;};
  try{
   const s=await this.port.school(action==='select'?'select':'refresh',action==='select'?{school:input.school}:{});check();
   if(s.workspace.phase==='network_error')throw new TaskFault('NETWORK');
   if(s.workspace.phase!=='approved'||!s.selected){this.#state={...emptyTaskState(),notice:s.workspace.phase==='expired_session'?'로그인 시간이 만료되었습니다.':'승인된 학교 소속을 확인해 주세요.',notice_kind:'error'};return this.snapshot();}
   const school=s.selected;if(this.#state.school_id&&school!==this.#state.school_id)throw new TaskFault('STALE');
   if(action==='select'&&s.workspace.context?.role==='HEALTH_ASSISTANT')this.#state.scope='MINE';
   this.#state.school_id=school;this.#state.school_name=s.self.memberships.find(m=>m.school_id===school)?.school_name;
   if(action==='refresh'){
    if('status'in input)this.#state.status=String(input.status)as TaskState['status'];if('sort'in input)this.#state.sort=String(input.sort)as TaskState['sort'];if('scope'in input)this.#state.scope=String(input.scope)as TaskState['scope'];if('archives'in input)this.#state.archives=input.archives===true;
   }
   const base={p_school_id:school,p_task_id:String(input.id??''),p_expected_version:Number(input.version),p_request_id:String(input.request_id??'')};
   const fields={p_title:String(input.title??''),p_description:String(input.description??''),p_priority:input.priority as 'LOW'|'NORMAL'|'HIGH',p_due_date:input.due_date?String(input.due_date):null};
   if(action==='create'){const v=await call('ws_v1_create_task',{p_school_id:school,...fields,p_assignees:input.assignees as string[],p_request_id:base.p_request_id})as{task_id:string};input.id=v.task_id;}
   if(action==='edit')await call('ws_v1_edit_task',{...base,...fields});
   if(action==='assign')await call('ws_v1_assign_task',{...base,p_assignees:input.assignees as string[]});
   if(action==='status')await call('ws_v1_change_assigned_task_status',{...base,p_status:String(input.status)});
   if(action==='close')await call('ws_v1_close_task',{...base,p_mode:String(input.mode)});
   if(action==='refresh'&&this.#state.detail)this.#state.detail=await call('ws_v1_get_task',{p_school_id:school,p_task_id:this.#state.detail.task_id})as Task;
   if(action==='detail'||action==='history'||write&&input.id)this.#state.detail=await call('ws_v1_get_task',{p_school_id:school,p_task_id:String(input.id)})as Task;
   if(action==='history')this.#state.history=await call('ws_v1_list_task_history',{p_school_id:school,p_task_id:String(input.id)})as History[];else this.#state.history=undefined;
   this.#state.board=await call('ws_v1_list_tasks',{p_school_id:school,p_status:this.#state.status||null,p_sort:this.#state.sort,p_scope:this.#state.scope,p_include_archived:this.#state.archives})as Board;
   this.#state.phase='ready';this.#state.notice=write?'서버 저장과 최신 상태를 확인했습니다.':undefined;this.#state.notice_kind=write?'success':undefined;
  }catch(e){if(g!==this.#generation)return this.snapshot();
   const kind=e instanceof TaskFault?e.kind:e instanceof WorkspaceAuthError&&e.code==='UNAUTHENTICATED'?'EXPIRED':'NETWORK';
   if(kind==='STALE')return this.snapshot();
   if(kind==='DENIED'||kind==='EXPIRED'){this.#state={...emptyTaskState(),phase:'denied',notice:kind==='EXPIRED'?'로그인 시간이 만료되었습니다.':'접근 권한이 없거나 이용 기간이 만료되었습니다.',notice_kind:'error'};}
   else{this.#state.phase=kind==='CONFLICT'?'conflict':kind==='INPUT'?'ready':'offline';this.#state.notice_kind='error';this.#state.notice=kind==='CONFLICT'?'다른 변경이 있거나 요청 정보가 다릅니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.':kind==='INPUT'?'운영 업무만 짧게 입력해 주세요. 학생·건강·상담·인증정보는 저장할 수 없습니다.':'저장 완료 여부를 확인하지 못했습니다. 연결 후 최신 내용을 새로고침해 주세요.';}
  }finally{if(write)this.#busy=false;}
  return this.snapshot();
 }
}
