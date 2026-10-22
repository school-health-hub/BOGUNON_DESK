import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/pretendard/400.css';
import '@fontsource/pretendard/500.css';
import '@fontsource/pretendard/600.css';
import '../styles/base.css';
import '../styles/dashboard.css';
import '../styles/components.css';
import '../styles/release-ui.css';
import '../styles/desktop-workspace.css';
import { AiVideoFinder, type AiFinderConnection } from '../education-video/AiVideoFinder';
import type { AiVideoCandidate, SearchConditions } from '../education-video/aiVideo';
const mode = new URLSearchParams(location.search).get('mode');
const videos = ['abcdefghijk', 'bcdefghijkl', 'cdefghijklm'].map((id, index) => ({ url: `https://www.youtube.com/watch?v=${id}`, description: `합성 QA 공개 소개정보 ${index + 1}. 실제 영상의 설명이 아닙니다.`, relevance: '교육 대상이 이해할 수 있는 설명인지 확인합니다.', reason: '교사가 원문과 영상 내용을 직접 확인해야 합니다.' }));
function Fixture() {
 const [selectedModel, setSelectedModel] = useState('gpt-6-sol');
 const [saved, setSaved] = useState<readonly {candidate: AiVideoCandidate; conditions: SearchConditions}[]>([]);
 const [message, setMessage] = useState('');
 const connection: AiFinderConnection = {
  state: { status: 'connected', email: 'synthetic@example.test', displayName: '합성 계정', planUsageEnabled: true, clientRegistrationExists: true, showPlanUsageNotice: false, notice: null, isLoading: false, isSigningIn: false, isDisconnecting: false, error: null },
  models: [{ slug: 'gpt-6-sol', displayName: '합성 검색 모델' }, { slug: 'unsupported', displayName: '웹 검색 미지원 합성 모델' }], selectedModel, setSelectedModel, supportsWebSearch: mode !== 'unsupported' && selectedModel !== 'unsupported',
  searchWeb: async () => { if (mode === 'error') throw new Error('합성 실패'); return { text: mode === 'malformed' ? 'not-json' : JSON.stringify({ videos: mode === 'empty' ? [] : videos }), checkedAt: '2026-10-22T10:00:00Z', sources: (mode === 'insufficient' ? [] : videos).map((video, index) => ({ url: video.url, title: `합성 교육영상 후보 ${index + 1} — 원문과 교육 적합성을 교사가 확인합니다` })) }; },
  generateText: async () => '합성 AI 검토: 공개 소개정보만 검토했습니다. 실제 영상 시청·전체 자막 분석 결과가 아닙니다.',
 };
 return <><p style={{ padding: '12px 28px', background: '#fcf6e8', color: '#75521c' }}>합성 QA 전용 · 실제 계정·AI·웹 검색·로컬 파일에 연결되지 않습니다.</p>{message && <p role="status">{message}</p>}<AiVideoFinder connection={connection} onClose={() => setMessage('합성 QA 닫기')} onOpenSettings={() => setMessage('합성 QA에서는 실제 계정 설정을 열지 않습니다.')} onOpenUrl={async () => { setMessage('합성 QA: 외부 URL 실행 생략'); }} onSave={async (candidate, conditions) => setSaved(current => [...current.filter(item => item.candidate.videoId !== candidate.videoId), { candidate, conditions }])} onDraft={input => setMessage(`합성 기안 연결: ${input.workName} / ${input.target}`)} saved={saved} /></>;
}
const root = document.getElementById('root'); if (root) createRoot(root).render(<Fixture />);
