import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import '@fontsource/pretendard/400.css';
import '@fontsource/pretendard/500.css';
import '@fontsource/pretendard/600.css';
import '../styles/base.css';
import '../styles/dashboard.css';
import '../styles/components.css';
import '../styles/release-ui.css';
import '../styles/desktop-workspace.css';
import { ChatGptConnectionProvider } from '../chatgpt/ChatGptConnectionContext';
import { AiConnectionProvider } from '../ai/AiConnectionContext';
import { OfficialDocumentSessionProvider } from '../official-document/OfficialDocumentSessionContext';
import { ConnectedFinder } from '../education-video/ConnectedFinder';
import { createDisabledApiConnection, createReadOnlyConnection, fifthSearchApproved, READ_ONLY_GUIDANCE, verifyFifthSearchMetadata } from './services';
import './qa.css';
declare const __FINDER_LIVE_QA_SOURCE_SHA__: string;
declare const __FINDER_LIVE_QA_BASE_SHA__: string;
function LiveQa() {
 const [notice, setNotice] = useState('');
 const [metadataVerified, setMetadataVerified] = useState(false);
 const inspect = async () => {
  setMetadataVerified(false);
  try {
   const metadata = await invoke<unknown>('finder_live_qa_metadata');
   if (!verifyFifthSearchMetadata(metadata, { sourceSha: __FINDER_LIVE_QA_SOURCE_SHA__, baseSha: __FINDER_LIVE_QA_BASE_SHA__ })) throw new Error('QA source stamp mismatch');
   if (!fifthSearchApproved(metadata)) {
    setNotice('QA5 소스·격리·증거 보존·미사용 슬롯을 확인했습니다. 실제 검색은 아직 승인되지 않아 검색 화면을 열지 않습니다.');
    return;
   }
   setMetadataVerified(true);
   setNotice('네이티브·화면 소스 SHA와 격리 식별자가 일치합니다. 읽기 전용 인증·독립 라이브러리·외부 dispatch 차단·SSE 진단 v3·tool_choice:auto·승인된 미사용 QA5 슬롯을 확인했습니다. 이 점검에서 검색·AI 생성은 호출하지 않았습니다.');
  } catch { setNotice('네이티브 QA 메타데이터를 확인하지 못했습니다. 지정된 격리 QA 실행 파일을 사용해 주세요.'); }
 };
 return <><aside className="finder-live-qa-banner" aria-label="격리 실행 환경"><strong>Finder Live QA5 · 별도 실행 파일</strong><p>{READ_ONLY_GUIDANCE}</p><p>QA5 전용 슬롯 준비 · 실제 검색은 별도 승인 후 최대 1회: 마약류 예방교육 · 고등학생 · 20분 내외 · 공공기관 우선. 전송 확인창의 문구가 승인된 프롬프트와 정확히 일치해야 하며, 다른 조건은 전송 전에 차단됩니다. QA1~QA4 증거는 수정하지 않습니다. 추가 AI 추천 이유 요청은 허용하지 않습니다.</p><p>이 앱의 라이브러리·설정은 운영 앱과 분리됩니다. 승인 마커가 없으면 검색 화면도 열리지 않습니다. 추후 승인 시 검색 1회만 실행하며 AI 상세 검토·기안 생성·보관함 저장은 수행하지 않습니다. Supabase·YouTube 직접 호출 및 운영 배포 기능은 없습니다.</p><details open><summary>소스 기준과 필수 사전 점검</summary><p>기준 체크포인트: <code>{__FINDER_LIVE_QA_BASE_SHA__}</code></p><p>QA5 오버레이 소스: <code>{__FINDER_LIVE_QA_SOURCE_SHA__}</code></p><button type="button" onClick={() => { void inspect(); }}>네이티브 메타데이터 확인 (AI 호출 없음)</button></details>{notice && <p role="status">{notice}</p>}</aside>{!metadataVerified && <p className="finder-live-qa-banner" role="status">QA5 승인 전에는 검색 화면이 열리지 않습니다. 위 점검은 소스·격리·증거·슬롯 상태만 확인하며 외부 요청을 보내지 않습니다.</p>}{metadataVerified && <ChatGptConnectionProvider createService={createReadOnlyConnection}><AiConnectionProvider createService={createDisabledApiConnection}><OfficialDocumentSessionProvider><ConnectedFinder onClose={() => setNotice('이 실행 파일은 Finder 전용입니다. 창의 닫기 버튼으로 종료해 주세요.')} /></OfficialDocumentSessionProvider></AiConnectionProvider></ChatGptConnectionProvider>}</>;
}
const root = document.getElementById('root');
if (root === null) throw new Error('Finder Live QA root unavailable');
createRoot(root).render(<LiveQa />);
