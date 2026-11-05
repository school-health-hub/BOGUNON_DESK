import {calculateHealthSupportInstructorManager} from './domain.js';
import type {SchoolState} from '../../school02/core/types.js';
import {parseHealthSupportInstructorInput,parseHealthSupportWorkLogMutation} from './validation.js';
import {monthValue,uuid,teacher,type Action,type Board,type Bridge,type State} from './types.js';
export interface Port {school():Promise<SchoolState>;call(name:'ws_v1_instructor_read'|'ws_v1_instructor_write',input:Record<string,unknown>,signal:AbortSignal):Promise<unknown>}
/** No independent auth. Every call refreshes the existing approved-school scope. */
export class InstructorController implements Bridge {
 private generation=0;private abort=new AbortController();private busy=-1;
 constructor(private port:Port){}
 invalidate(){this.generation++;this.abort.abort();this.abort=new AbortController();}
 async command(action:Action,input:Record<string,unknown>):Promise<State>{
  const g=this.generation,signal=this.abort.signal,fresh=()=>{if(g!==this.generation||signal.aborted)throw Error('stale');};
  if(this.busy===g)return {phase:'error',message:'저장 중입니다. 다시 확인해 주세요.'};
  const write=action!=='read';if(write)this.busy=g;
  try{
   const month=monthValue(input.month);if(!uuid(input.school))throw Error('input');
   const scope=await this.port.school();fresh();
   if(scope.workspace.phase!=='approved'||scope.selected!==input.school)return {phase:'locked',message:'승인된 학교 소속·로그인을 다시 확인해 주세요.'};
   if(write){
    if(!teacher(scope.workspace.context?.role??''))return {phase:'locked',message:'보건교사 편집 권한을 다시 확인해 주세요.'};
    if(!['settings','save','delete','import'].includes(action)||!Number.isSafeInteger(input.version)||Number(input.version)<0||!uuid(input.request_id))throw Error('input');
    let payload:unknown;
    if(action==='settings')payload=parseHealthSupportInstructorInput(input.payload);
    if(action==='save'){const p=input.payload as Record<string,unknown>;payload={...parseHealthSupportWorkLogMutation(p),id:p?.id??null};if(p?.id!==null&&p?.id!==undefined&&!uuid(p.id))throw Error('input');}
    if(action==='delete'){if(!uuid(input.id))throw Error('input');payload={id:input.id};}
    if(action==='import'){if(!Array.isArray(input.payload)||input.payload.length>1000)throw Error('input');payload=input.payload.map(parseHealthSupportWorkLogMutation);}
    await this.port.call('ws_v1_instructor_write',{p_school_id:input.school,p_kind:action,p_payload:payload,p_expected_version:input.version,p_request_id:input.request_id},signal);fresh();
   }
   const board=await this.port.call('ws_v1_instructor_read',{p_school_id:input.school,p_month:month},signal) as Board;fresh();
   if(!board||board.school!==input.school||board.month!==month||board.role!==scope.workspace.context?.role||!Number.isSafeInteger(board.version)||board.version<0||typeof board.name!=='string'||board.name.length>120||!Array.isArray(board.logs)||board.logs.length>5000||!Array.isArray(board.schedule)||board.schedule.length>5000||Object.keys(board).some(k=>!['school','month','role','version','name','instructor','logs','schedule'].includes(k)))throw Error('response');
   if(teacher(board.role)){if(board.instructor){parseHealthSupportInstructorInput(board.instructor);if(!uuid(board.instructor.id))throw Error('response');}for(const r of board.logs){parseHealthSupportWorkLogMutation(r);if(!uuid(r.id))throw Error('response');}}else if(board.instructor!==null||board.logs.length)throw Error('response');
   for(const r of board.schedule)if(!uuid(r.id)||Object.keys(r).some(k=>!['id','date','startTime','endTime','hours'].includes(k)))throw Error('response');
   // Match JavaScript toFixed rounding in the original, including 1.005-hour boundaries.
   // The read-only server projection contains times only, never private settings or notes.
   const calculated=calculateHealthSupportInstructorManager({workLogs:board.schedule.map(r=>({instructorId:'shared',date:r.date,startTime:r.startTime,endTime:r.endTime}))});
   board.schedule=board.schedule.map((r,n)=>({...r,hours:calculated.workLogs[n].hours}));
   return {phase:'ready',board,message:write?'격리된 공유 저장에 반영하고 최신 자료를 확인했습니다.':undefined};
  }catch{return {phase:'error',message:g!==this.generation?'학교·계정이 바뀌어 이전 요청을 폐기했습니다.':'저장·조회하지 못했습니다. 권한·연결·변경 충돌을 확인하세요. 기존 자료는 유지됩니다.'};}
  finally{if(write&&this.busy===g)this.busy=-1;}
 }
}
