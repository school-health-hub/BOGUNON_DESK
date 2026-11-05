import {useState,useSyncExternalStore} from 'react';
import type {WorkspaceCoordinator,WorkspacePhase} from '../core/workspace.js';
import './workspace.css';
const labels:Record<WorkspacePhase,string>={signed_out:'로그인이 필요합니다',signing_in:'로그인하고 있습니다',authenticated_unselected:'학교를 선택해 주세요',pending:'학교 가입 승인을 기다리고 있습니다',approved:'공동 기능을 이용할 수 있습니다',suspended:'학교 이용이 일시 정지되었습니다',expired_membership:'학교 소속 기간이 만료되었습니다',recovery_locked:'학교 관리자 확인이 필요합니다',expired_session:'로그인 시간이 만료되었습니다',network_error:'연결을 확인한 뒤 다시 시도해 주세요',access_denied:'이 학교에 접근할 권한이 없습니다',conflict:'다른 변경이 있습니다. 학교를 다시 선택해 주세요'};
export function WorkspacePanel({controller,client='web'}:{controller:WorkspaceCoordinator;client?:'web'|'electron'}){
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot),[busy,setBusy]=useState(false);
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();}finally{setBusy(false);}};
 return <section className="ws-c" aria-labelledby="ws-c-title">
  <header><span className="ws-c-brand">BOGUNON DESK · {client==='web'?'웹 보조 클라이언트':'개인 DESK'}</span><h1 id="ws-c-title">우리 보건실</h1><p>우리 학교의 업무를 함께 준비하는 공간</p></header>
  <p className="ws-c-dev">개발용 합성 화면 · 실제 학교 자료가 없습니다</p>
  <div className="ws-c-card"><h2>연결 상태</h2><p role="status" aria-live="polite">{labels[state.phase]}</p>
   <div className="ws-c-actions"><button disabled={busy||state.phase==='signing_in'} onClick={()=>void act(()=>controller.login())}>{state.phase==='signed_out'?'로그인':'다시 로그인'}</button><button className="ws-c-secondary" disabled={busy||state.phase==='signed_out'} onClick={()=>void act(()=>controller.logout())}>로그아웃</button></div>
  </div>
  {state.phase!=='signed_out'&&state.phase!=='signing_in'&&<div className="ws-c-card"><h2>현재 학교</h2><label>학교 선택<select disabled={busy} value={state.schoolId??''} onChange={e=>void act(()=>controller.selectSchool(e.target.value))}><option value="" disabled>학교를 선택해 주세요</option><option value="synthetic-a">합성 학교 A</option><option value="synthetic-b">합성 학교 B</option></select></label>
   {state.context&&<p>내 역할: {state.context.role==='SCHOOL_ADMIN'?'학교 관리자':state.context.role==='HEALTH_TEACHER'?'보건교사':'보건지원강사'}</p>}
   <p>{state.phase==='approved'?'공동 업무·일정·인수인계 기능은 다음 단계에서 연결합니다.':'승인된 학교 소속이 확인되면 공동 기능을 이용할 수 있습니다.'}</p>
  </div>}
  <footer>개인 업무와 로컬 자료는 로그인 없이 계속 이용할 수 있습니다.</footer>
 </section>;
}
