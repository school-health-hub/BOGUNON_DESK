import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {UpdateState} from '../../update-protocol.js';
import './update.css';

export function UpdateWindow(){
  const [state,setState]=useState<UpdateState|null>(null);
  useEffect(()=>{let active=true;void window.electronUpdate.status().then(value=>{if(active)setState(value);});const dispose=window.electronUpdate.onState(value=>{if(active)setState(value);});return()=>{active=false;dispose();};},[]);
  const run=(action:'check'|'download'|'cancel'|'install')=>{void window.electronUpdate[action]().then(setState).catch(()=>setState(previous=>({...previous,phase:'failed',currentVersion:previous?.currentVersion??'',message:'업데이트 작업에 실패했습니다. 다시 시도해 주세요.'})));};
  const phase=state?.phase;
  return <main className="update-card" aria-label="앱 업데이트">
    <header><span className="update-mark" aria-hidden="true">B</span><div><h1>BOGUNON DESK 업데이트</h1><p>새 버전을 준비합니다.</p></div></header>
    <section className="update-body"><h2>{phase==='available'?'새 업데이트가 있어요!':phase==='ready'?'설치할 준비가 됐어요':'앱 업데이트'}</h2>
      <p className="update-version">현재 {state?.currentVersion??'확인 중'}{state?.nextVersion?` → 새 버전 ${state.nextVersion}`:''}</p>
      {state?.notes&&<p className="update-notes">{state.notes}</p>}
      <p role="status" aria-live="polite">{phase==='checking'?'업데이트 확인 중…':phase==='downloading'?`다운로드 중… ${state?.progress??0}%`:phase==='current'?'최신 버전을 사용 중입니다.':phase==='available'?'다운로드를 시작할 수 있습니다.':state?.message??'업데이트 상태를 확인해 주세요.'}</p>
      {phase==='downloading'&&<progress aria-label="다운로드 진행률" max="100" value={state?.progress??0}/>}
      {phase==='ready'&&<p className="update-safety">설치 전에 저장하지 않은 작업을 확인합니다. 동의하기 전에는 앱이 종료되지 않습니다.</p>}
    </section>
    <footer>
      {(phase==='idle'||phase==='current'||phase==='failed')&&<button type="button" className="primary" onClick={()=>run('check')}>{phase==='failed'?'다시 시도':'업데이트 확인'}</button>}
      {phase==='available'&&<button type="button" className="primary" onClick={()=>run('download')}>업데이트 받기</button>}
      {phase==='downloading'&&<button type="button" onClick={()=>run('cancel')}>다운로드 취소</button>}
      {phase==='ready'&&state?.installSupported&&<button type="button" className="primary" onClick={()=>run('install')}>업데이트 설치하고 다시 시작</button>}
      <button type="button" onClick={()=>window.electronUpdate.dismiss()}>나중에 하기</button>
    </footer>
  </main>;
}
document.body.classList.add('electron-soft-rose');
createRoot(document.getElementById('root')!).render(<React.StrictMode><UpdateWindow/></React.StrictMode>);
