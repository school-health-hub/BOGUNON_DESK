import {useEffect,useRef,useState} from 'react';import type {AccountState} from '../../account-protocol';import type {SchoolLoad} from '../../school-protocol';
const STATUS_LABEL:Record<AccountState['status'],string>={signedOut:'로그아웃됨',signingIn:'로그인 진행 중',signedIn:'로그인됨',expired:'다시 로그인 필요',temporaryError:'연결 확인 필요',storageError:'계정 정보를 안전하게 저장할 수 없음'};
export function BogunonAccount({local,onSchoolApplied}:{local:SchoolLoad|null;onSchoolApplied:()=>Promise<void>}){
 const api=window.electronWork.account,[state,setState]=useState<AccountState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const live=useRef(true),locked=useRef(false),sequence=useRef(0);
 const load=async()=>{if(!api||locked.current)return;const ticket=++sequence.current;try{const result=await api.status();if(!result.ok)throw Error(result.error.message);if(live.current&&ticket===sequence.current)setState(result.data);}catch{if(live.current)setError('계정 상태를 불러오지 못했습니다. 로컬 자료는 유지됩니다.');}};
 useEffect(()=>{live.current=true;void load();return()=>{live.current=false;sequence.current++;};},[api]);
 useEffect(()=>{if(state?.status!=='signingIn')return;const timer=setInterval(()=>void load(),1000);return()=>clearInterval(timer);},[state?.status,api]);
 const run=async(action:()=>Promise<void>)=>{if(locked.current)return;locked.current=true;setBusy(true);sequence.current++;setError('');try{await action();}catch(e){if(live.current)setError(e instanceof Error?e.message:'계정 작업에 실패했습니다.');}finally{locked.current=false;if(live.current){setBusy(false);void load();}}};
 const action=(kind:'signIn'|'signOut'|'cancel'|'refresh')=>void run(async()=>{if(!api)return;const result=await api[kind]();if(!result.ok)throw Error(result.error.message);if(live.current)setState(result.data);});
 if(!api)return <p>이 실행본에는 BOGUNON 계정 연결이 없습니다. NEIS 검색과 기존 로컬 학교를 사용할 수 있습니다.</p>;
 return <section className="bogunon-account" aria-label="BOGUNON 계정 연결"><h3>BOGUNON 계정 연결</h3><p>BOGUNON 계정으로 로그인하면 계정에 등록된 학교를 확인할 수 있습니다. 업무포털·나이스·eVPN 로그인은 별도로 진행합니다.</p>
  <p role="status">계정 상태: {state?STATUS_LABEL[state.status]:'확인 중'}</p>{state&&!state.configured&&<p>현재 실행본에서는 계정 로그인을 사용할 수 없습니다. 학교 검색과 이 PC의 업무는 계속 사용할 수 있습니다.</p>}{state?.status==='temporaryError'&&<p>잠시 후 다시 확인해 주세요. 이 PC의 자료는 그대로 유지됩니다.</p>}{error&&<p role="alert">{error}</p>}
  {state?.user&&<p>현재 계정: {state.user.displayName??state.user.email??'연결된 계정'}</p>}
  <button type="button" disabled={busy||!state?.configured||!state.secureStorage||state.status==='signingIn'||state.status==='storageError'} onClick={()=>action('signIn')}>{state?.status==='signedIn'?'다른 BOGUNON 계정 연결':'Google로 BOGUNON 로그인'}</button>
  {state?.status==='signingIn'&&<button type="button" disabled={busy} onClick={()=>action('cancel')}>계정 로그인 취소</button>}
  <button type="button" disabled={busy||!state?.secureStorage} onClick={()=>action('signOut')}>BOGUNON 로그아웃·연결 해제</button><button type="button" disabled={busy||state?.status==='signingIn'} onClick={()=>action('refresh')}>계정·등록 학교 다시 확인</button>
  {state?.school?<><p>계정 등록 학교: {state.school.schoolName} · {state.school.officeName} · {state.school.officeCode} / {state.school.schoolCode}</p><p>현재 로컬 학교: {local?.document.school?.schoolName??'미설정'}. 일치 여부와 코드를 확인하고 직접 적용하세요. 주소·로컬 업무는 자동 교체하지 않습니다.</p>
   <button type="button" disabled={busy||!local||local.recovered||state.status!=='signedIn'} onClick={()=>void run(async()=>{if(!local)return;const result=await api.applySchool({accountRevision:state.revision,expectedSchoolRevision:local.document.revision});if(!result.ok)throw Error(result.error.message);if(result.data&&live.current)await onSchoolApplied();})}>계정 학교 확인 후 로컬 적용</button></>:<p>등록 학교가 없거나 확인되지 않았습니다. 아래 NEIS 공개 학교 검색을 사용할 수 있습니다.</p>}
  <p>로그아웃하거나 계정을 바꾸어도 이 PC에 직접 저장한 학교·업무 주소와 로컬 자료는 유지됩니다.</p>
 </section>;
}
