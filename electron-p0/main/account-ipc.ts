import {assertSender} from './policy.js';import {SchoolProfileStore,SchoolConflict} from './school-profile.js';import {AccountService} from './account-service.js';
import {schoolKeys} from '../school-protocol.js';import type {IpcResult} from '../protocol.js';
import type {AccountReview} from '../account-protocol.js';
export function createAccountHandlers(contents:Parameters<typeof assertSender>[1],url:string,service:AccountService,school:SchoolProfileStore,review:(kind:AccountReview['kind'],message:string,detail:string)=>Promise<boolean>){
 let generation=0;const fresh=(event:Parameters<typeof assertSender>[0],ticket:number)=>{assertSender(event,contents,url);if(ticket!==generation)throw Error();};
 const run=(arity:number,action:(args:unknown[],event:Parameters<typeof assertSender>[0],ticket:number)=>Promise<unknown>)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<unknown>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 계정 요청입니다.',retryable:false}};}
  if(args.length!==arity)return {ok:false,error:{code:'INVALID_INPUT',message:'계정 요청 형식을 확인해 주세요.',retryable:false}};
  try{return {ok:true,data:await action(args,event,generation)};}catch(error){return {ok:false,error:{code:error instanceof SchoolConflict?'CONFLICT':'INTERNAL_ERROR',message:'계정 또는 학교 설정이 변경됐거나 요청을 완료하지 못했습니다. 다시 확인해 주세요. 기존 로컬 자료는 유지됩니다.',retryable:true}};}
 };
 return {status:run(0,()=>service.status()),refresh:run(0,()=>service.refresh()),signIn:run(0,async(_args,event,ticket)=>{const state=await service.status();if(!state.configured||!state.secureStorage)return state;if(!await review('signIn','기존 BOGUNON Google 계정에 연결할까요?','기본 브라우저에서 Google 계정을 선택합니다. 이 PC에 저장된 메모·설정은 유지되며, 계정 전환 시 이전 계정의 서버 조회 상태를 정리합니다.'))return state;fresh(event,ticket);return service.signIn();}),
  signOut:run(0,async(_args,event,ticket)=>{if(!await review('signOut','이 PC의 BOGUNON 계정 연결을 해제할까요?','현재 서버 사용자·학교 조회 상태를 정리합니다. 확인해 적용한 로컬 학교·업무·주소·Finance는 삭제하지 않습니다.'))return service.status();fresh(event,ticket);generation++;return service.signOut();}),cancel:run(0,async()=>{generation++;return service.cancel();}),
  applySchool:run(1,async(args,event,ticket)=>{const input=args[0];if(!schoolKeys(input,['accountRevision','expectedSchoolRevision'])||!Number.isSafeInteger(input.accountRevision)||Number(input.accountRevision)<0||!Number.isSafeInteger(input.expectedSchoolRevision)||Number(input.expectedSchoolRevision)<0)throw Error();
   const selected=service.schoolSnapshot(Number(input.accountRevision)),local=await school.load();if(local.recovered||local.document.revision!==input.expectedSchoolRevision)throw new SchoolConflict();
   const label=(v:typeof selected.school|null)=>v?`${v.schoolName} / ${v.officeName} / ${v.officeCode} / ${v.schoolCode}`:'미설정';
   if(!await review('applySchool','계정에 등록된 학교를 이 PC에 적용할까요?',`현재 학교: ${label(local.document.school)}\n계정에 등록된 학교: ${label(selected.school)}\n학교 정보만 이 PC에 저장합니다. 기존 업무 주소와 자료는 자동으로 바뀌지 않습니다.`))return null;
   fresh(event,ticket);service.guardSchool(Number(input.accountRevision),selected.userId,selected.school);const checked=await service.refresh();fresh(event,ticket);if(checked.user?.id!==selected.userId||JSON.stringify(checked.school)!==JSON.stringify(selected.school))throw Error();
   const guard=async()=>{fresh(event,ticket);service.guardSchool(checked.revision,selected.userId,selected.school);};await guard();return school.save(selected.school,input.expectedSchoolRevision,guard);
  }),invalidate:()=>{generation++;service.suspend();},dispose:()=>{generation++;service.dispose();},flush:()=>service.flush()};
}
