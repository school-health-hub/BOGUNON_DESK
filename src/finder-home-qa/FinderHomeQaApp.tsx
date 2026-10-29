import { useEffect, useState } from 'react';
import { OfficialDocumentSessionProvider } from '../official-document/OfficialDocumentSessionContext';
import { FinderQaWorkspace } from './FinderQaWorkspace';
import { invoke } from './qaIpc';
import { parseFinderQaMetadata, type FinderQaMetadata } from './metadata';

export function FinderHomeQaApp() {
  const [info, setInfo] = useState<FinderQaMetadata | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void invoke<unknown>('finder_home_qa_metadata').then(value => {
      if (!active) return;
      const metadata = parseFinderQaMetadata(value, __FINDER_HOME_QA_SOURCE_SHA__);
      if (metadata === null) setFailed(true); else setInfo(metadata);
    }).catch((error: unknown) => {
      if (!(error instanceof Error) && typeof error !== 'string') throw error;
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);
  if (failed) return <main className="aiv-finder" role="alert">QA 격리 정보를 확인하지 못했습니다. 라이브러리는 열지 않았습니다. 실행을 중지하세요.</main>;
  if (info === null) return <main className="aiv-finder" role="status">격리 실행 경계를 확인하는 중입니다.</main>;
  return <div className="finder-home-qa-shell">
    <header className="aiv-account finder-home-qa-banner">
      <div><strong>Finder HOME QA · 합성 데이터 전용</strong><p>실제 검색·AI·인증·모델 조회·Supabase·외부 URL·업데이트 비활성</p></div>
      <details><summary>Source SHA · {info.sourceSha.slice(0, 7)}{__FINDER_HOME_QA_DIRTY__ ? ' · 미커밋 소스 포함' : ''}</summary>
        <p>{info.sourceSha}</p><p>{info.identifier}</p><p>QA 라이브러리: {info.localData}</p><p>WebView2: {info.webviewData}</p>
      </details>
    </header>
    <OfficialDocumentSessionProvider><FinderQaWorkspace /></OfficialDocumentSessionProvider>
  </div>;
}
