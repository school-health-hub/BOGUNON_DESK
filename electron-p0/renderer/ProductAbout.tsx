import {useEffect,useState} from 'react';
import type { P0Info } from '../protocol';
import type { P0UpdateState } from '../protocol';

type ProductAboutProps = Readonly<{
  info: P0Info;
}>;

export function ProductAbout({ info }: ProductAboutProps) {
  const [update,setUpdate]=useState<P0UpdateState|null>(null);
  const [dismissedVersion,setDismissedVersion]=useState<string|null>(null);
  useEffect(()=>{let active=true;void window.electronP0.updates.status().then(state=>{if(active)setUpdate(state);});const dispose=window.electronP0.updates.onState(state=>{if(active)setUpdate(state);});return()=>{active=false;dispose();};},[]);
  const run=(action:'check'|'download'|'cancel'|'install')=>{void window.electronP0.updates[action]().then(setUpdate).catch(()=>setUpdate({phase:'failed',currentVersion:info.version,message:'업데이트 작업에 실패했습니다. 다시 시도해 주세요.'}));};
  return <div className="product-about">
    <h2>BOGUNON DESK 2.0</h2>
    <p>내부 베타 · 버전 {info.version}</p>
    <p>보건교사의 업무를 한곳에서 정리하는 Windows 데스크톱 작업 공간입니다.</p>
    <section className="product-update" aria-label="앱 업데이트">
      <h3>{update?.phase==='available'&&update.nextVersion!==dismissedVersion?'새 업데이트가 있어요!':'앱 업데이트'}</h3>
      <p>현재 버전 {info.version}{update?.nextVersion?` · 새 버전 ${update.nextVersion}`:''}</p>
      {update?.notes&&update.nextVersion!==dismissedVersion&&<p className="product-update-notes">{update.notes}</p>}
      <p role="status">{update?.phase==='checking'?'업데이트 확인 중…':update?.phase==='current'?'최신 버전을 사용 중입니다.':update?.phase==='available'&&update.nextVersion!==dismissedVersion?'새 버전을 다운로드할 수 있습니다.':update?.phase==='downloading'?`다운로드 중… ${update.progress??0}%`:update?.message??'업데이트 상태를 확인할 수 있습니다.'}</p>
      <div className="product-update-actions">
        {update?.phase!=='unavailable'&&<button type="button" disabled={update?.phase==='checking'||update?.phase==='downloading'||update?.phase==='installing'} onClick={()=>run('check')}>{update?.phase==='failed'?'다시 시도':'업데이트 확인'}</button>}
        {update?.phase==='available'&&update.nextVersion!==dismissedVersion&&<><button type="button" className="product-update-primary" onClick={()=>run('download')}>업데이트 받기</button><button type="button" onClick={()=>setDismissedVersion(update.nextVersion??null)}>나중에 하기</button></>}
        {update?.phase==='downloading'&&<button type="button" onClick={()=>run('cancel')}>다운로드 취소</button>}
        {update?.phase==='ready'&&update.installSupported&&<button type="button" className="product-update-primary" onClick={()=>run('install')}>업데이트 설치하기</button>}
      </div>
      {update?.phase==='ready'&&!update.installSupported&&<p>파일 검증이 끝났습니다. 이 실행본에서는 자동 설치를 지원하지 않습니다. 설치 파일을 직접 실행해 주세요.</p>}
    </section>
    {import.meta.env.DEV&&<details>
      <summary>고급 진단 정보</summary>
      <dl>
        <dt>제품 식별자</dt><dd>{info.appId}</dd>
        <dt>로컬 저장 위치</dt><dd>{info.userData}</dd>
        <dt>소스 버전</dt><dd>{info.sourceSha}</dd>
        <dt>Electron</dt><dd>{info.electron}</dd>
      </dl>
    </details>}
  </div>;
}
