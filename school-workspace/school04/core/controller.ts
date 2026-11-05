import type{Action,ActivityState,Bridge,SharedEvent,Note,Context,Revision,EventHistory}from'./types.js';import{range,seoulDate}from'./time.js';import{TaskFault,type Board}from'../../school03/core/types.js';import type{SchoolState}from'../../school02/core/types.js';import{WorkspaceAuthError}from'../../auth/common/types.js';
export const empty=():ActivityState=>({phase:'locked',month:seoulDate().slice(0,7),events:[],notes:[],tasks:[]});
export interface Port{school(a:'select'|'refresh',i?:Record<string,unknown>):Promise<SchoolState>;call(name:string,args:Record<string,unknown>,signal:AbortSignal):Promise<unknown>;tasks(school:string,signal:AbortSignal):Promise<Board>}
export class ActivityController implements Bridge{
 #state=empty();#gen=0;#abort=new AbortController();#busy=false;
 constructor(readonly port:Port){}
 invalidate(){this.#gen++;this.#abort.abort();this.#abort=new AbortController();this.#state=empty();}
 snapshot(){return structuredClone(this.#state);}
 async command(action:Action,input:Record<string,unknown>={}):Promise<ActivityState>{
  if(action!=='select'&&input.school&&input.school!==this.#state.school_id)return{...empty(),notice:'학교를 다시 선택해 주세요.',notice_kind:'error'};if(action==='select')this.invalidate();const write=['event_save','event_cancel','note_create','note_edit','note_ack','note_complete'].includes(action);if(write&&this.#busy)return{...this.snapshot(),notice:'처리 중입니다.',notice_kind:'error'};if(write)this.#busy=true;
  const g=this.#gen,signal=this.#abort.signal,check=()=>{if(g!==this.#gen)throw new TaskFault('STALE');},call=async<T>(n:string,args:Record<string,unknown>)=>{const v=await this.port.call(n,args,signal);check();return v as T;};
  try{
   const school=await this.port.school(action==='select'?'select':'refresh',action==='select'?{school:input.school}:{});check();if(school.workspace.phase==='network_error')throw new TaskFault('NETWORK');if(school.workspace.phase!=='approved'||!school.selected){this.#state={...empty(),notice:school.workspace.phase==='expired_session'?'로그인 시간이 만료되었습니다.':'승인된 학교 소속을 확인해 주세요.',notice_kind:'error'};return this.snapshot();}
   const s=school.selected;if(this.#state.school_id&&s!==this.#state.school_id)throw new TaskFault('STALE');this.#state.school_id=s;this.#state.school_name=school.self.memberships.find(m=>m.school_id===s)?.school_name;
   if(input.month)this.#state.month=String(input.month);const period=range(this.#state.month);this.#state.context=await call<Context>('ws_v1_get_activity_context',{p_school_id:s});
   const req={p_school_id:s,p_expected_version:Number(input.version??0),p_request_id:String(input.request_id??'')},event={p_event_id:input.id?String(input.id):null},note={p_handover_id:String(input.id??'')};let result:{event_id?:string;handover_id?:string;revision?:number}|undefined;
   if(action==='event_save')result=await call('ws_v1_save_event',{...req,...event,p_title:input.title,p_description:input.description,p_start_at:input.start_at,p_end_at:input.end_at,p_all_day:input.all_day});
   if(action==='event_cancel')result=await call('ws_v1_cancel_event',{...req,p_event_id:String(input.id)});
   if(action==='note_create'||action==='note_edit')result=await call(action==='note_create'?'ws_v1_create_handover':'ws_v1_edit_handover',{...req,...(action==='note_edit'?note:{}),p_title:input.title,p_body:input.body,p_member_ids:input.member_ids,p_target_roles:input.target_roles});
   if(action==='note_ack')result=await call('ws_v1_ack_handover',{...req,...note,p_membership_id:input.member_id??this.#state.context.membership_id});
   if(action==='note_complete')result=await call('ws_v1_complete_handover',{...req,...note,p_completed:input.completed!==false});
   const e=result?.event_id??(action.startsWith('event_')?String(input.id??''):undefined),h=result?.handover_id??(action.startsWith('note_')?String(input.id??''):undefined);
   if(e)this.#state.event=await call<SharedEvent>('ws_v1_get_event',{p_school_id:s,p_event_id:e});if(h)this.#state.note=await call<Note>('ws_v1_get_handover',{p_school_id:s,p_handover_id:h});
   this.#state.event_history=action==='event_history'?await call<EventHistory[]>('ws_v1_list_event_history',{p_school_id:s,p_event_id:String(input.id)}):undefined;
   this.#state.note_history=action==='note_history'?await call<Revision[]>('ws_v1_list_handover_history',{p_school_id:s,p_handover_id:String(input.id)}):undefined;
   this.#state.events=await call<SharedEvent[]>('ws_v1_list_events',{p_school_id:s,p_from:period.from,p_to:period.to});this.#state.notes=await call<Note[]>('ws_v1_list_handovers',{p_school_id:s});if(this.#state.note)this.#state.note=this.#state.notes.find(n=>n.handover_id===this.#state.note?.handover_id);if(this.#state.event)this.#state.event=this.#state.events.find(e=>e.event_id===this.#state.event?.event_id);try{this.#state.tasks=(await this.port.tasks(s,signal)).tasks;}catch(e){if(e instanceof TaskFault&&e.kind==='DENIED')this.#state.tasks=[];else throw e;}check();
   this.#state.phase='ready';this.#state.notice=write?'서버 저장 후 최신 상태를 확인했습니다.':undefined;this.#state.notice_kind=write?'success':undefined;
   if(action==='note_ack'&&(!this.#state.note?.acknowledged||result?.revision!==this.#state.note.content_revision)){this.#state.phase='conflict';this.#state.notice='전달 내용이 바뀌었습니다. 최신 내용을 다시 확인해 주세요.';this.#state.notice_kind='error';}
  }catch(e){if(g!==this.#gen)return this.snapshot();const kind=e instanceof TaskFault?e.kind:e instanceof WorkspaceAuthError&&e.code==='UNAUTHENTICATED'?'EXPIRED':e instanceof Error&&e.message==='input'?'INPUT':'NETWORK';if(kind==='STALE')return this.snapshot();if(kind==='DENIED'||kind==='EXPIRED')this.#state={...empty(),phase:'denied',notice:'권한 또는 로그인 유효기간을 확인해 주세요.',notice_kind:'error'};else{this.#state.phase=kind==='CONFLICT'?'conflict':kind==='INPUT'?'ready':'offline';this.#state.notice_kind='error';this.#state.notice=kind==='CONFLICT'?'다른 변경이 있습니다. 최신 내용을 확인하고 다시 시도해 주세요.':kind==='INPUT'?'개인정보 없는 짧은 운영 내용과 올바른 날짜·대상을 입력해 주세요.':'온라인 연결이 필요합니다. 저장·확인 완료 여부를 확인하지 못했습니다.';}}
  finally{if(write)this.#busy=false;}return this.snapshot();
 }
}
