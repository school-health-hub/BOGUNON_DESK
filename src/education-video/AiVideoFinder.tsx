import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import type { ChatGptConnectionState, ChatGptModel } from '../chatgpt/types';
import type { WebSearchResult } from '../chatgpt/webSearch';
import { normalizeChatGptPlanError } from '../chatgpt/chatgptPlanService';
import { OfficialDocumentAiConfirmation } from '../components/desktop/OfficialDocumentAiConfirmation';
import { prepareOfficialDocumentAiSend } from '../official-document/officialDocumentAiService';
import type { OfficialDocumentInput } from '../official-document/types';
import { AiVideoFinderCards } from './AiVideoFinderCards';
import { buildVideoReviewPrompt, buildVideoSearchPrompt, candidateDraftInput, canonicalVideoUrl, parseVideoSearchResult, type AiVideoCandidate, type SearchConditions } from './aiVideo';
import './aiFinder.css';

export type AiFinderConnection = {
  readonly state: ChatGptConnectionState;
  readonly models: readonly ChatGptModel[];
  readonly selectedModel: string | null;
  readonly setSelectedModel: (model: string) => void;
  readonly supportsWebSearch: boolean;
  readonly searchWeb: (prompt: string) => Promise<WebSearchResult>;
  readonly generateText: (prompt: string) => Promise<string>;
};
type Props = {
  readonly connection: AiFinderConnection;
  readonly onClose: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenUrl: (url: string) => Promise<void>;
  readonly onSave: (candidate: AiVideoCandidate, conditions: SearchConditions) => Promise<void>;
  readonly onDraft: (input: OfficialDocumentInput) => void;
  readonly saved?: readonly { readonly candidate: AiVideoCandidate; readonly conditions: SearchConditions }[];
};
type Pending = { readonly prompt: string; readonly kind: 'search' | 'review'; readonly candidate?: AiVideoCandidate; readonly conditions: SearchConditions; readonly identity: string };
const topics = ['마약류 예방교육', '양성평등교육', '성폭력 예방교육', '감염병 예방교육', '생명존중교육', '응급처치교육', '직접 입력'];

export function AiVideoFinder(p: Props) {
  const [conditions, setConditions] = useState<SearchConditions>({ topic: '', target: '초등학생', minutes: 10, publicFirst: true });
  const [results, setResults] = useState<readonly AiVideoCandidate[]>([]);
  const [resultConditions, setResultConditions] = useState(conditions);
  const [reviews, setReviews] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState('교육 조건을 입력하면 실제 공개 영상의 검색 출처를 찾아 비교합니다.');
  const [manualUrl, setManualUrl] = useState('');
  const identity = `${p.connection.state.status}:${p.connection.state.email ?? ''}:${p.connection.selectedModel ?? ''}:${p.connection.state.planUsageEnabled}:${p.connection.supportsWebSearch}:${p.connection.state.isDisconnecting}:${p.connection.state.isSigningIn}`;
  const identityRef = useRef(identity);
  const sequence = useRef(0);
  identityRef.current = identity;
  useEffect(() => {
    sequence.current += 1; setPending(null); setBusy(false); setResults([]); setReviews({}); setSearched(false);
    return () => { sequence.current += 1; };
  }, [identity]);
  const available = p.connection.state.status === 'connected' && p.connection.supportsWebSearch;
  const prepare = (kind: Pending['kind'], candidate?: AiVideoCandidate) => {
    if (!available) { setNotice('웹 검색을 지원하는 ChatGPT 연결과 모델을 먼저 확인해 주세요.'); return; }
    try {
      const prompt = kind === 'search' ? buildVideoSearchPrompt(conditions) : candidate ? buildVideoReviewPrompt(candidate) : '';
      const checked = prepareOfficialDocumentAiSend({ outboundText: prompt, generate: async () => '' });
      if (checked.status === 'blocked') { setNotice(checked.error); return; }
      checked.gate.cancel();
      setPending({ kind, candidate, prompt, conditions: kind === 'search' ? { ...conditions } : resultConditions, identity });
    } catch { setNotice('교육 주제와 검색 조건을 확인해 주세요.'); }
  };
  const confirm = async (outboundText: string) => {
    const action = pending;
    if (!action || action.identity !== identityRef.current || !available) { setPending(null); return; }
    let webResult: WebSearchResult | null = null;
    const prepared = prepareOfficialDocumentAiSend({ outboundText, generate: async prompt => {
      if (action.kind === 'review') return p.connection.generateText(prompt);
      const found = await p.connection.searchWeb(prompt); webResult = found; return found.text;
    } });
    if (prepared.status === 'blocked') { setNotice(prepared.error); return; }
    const request = ++sequence.current;
    setPending(null); setBusy(true); setNotice(action.kind === 'search' ? '공개 교육영상의 검색 출처를 찾고 있습니다…' : '공개 소개정보를 검토하고 있습니다…');
    try {
      const text = await prepared.gate.confirm();
      if (request !== sequence.current || action.identity !== identityRef.current || text === null) return;
      if (action.kind === 'search' && webResult !== null) {
        const parsed = parseVideoSearchResult(webResult); setResults(parsed.candidates); setResultConditions(action.conditions); setSearched(true); setReviews({});
        setNotice(parsed.candidates.length ? `${parsed.candidates.length}개 후보를 찾았습니다. 원문과 교육 적합성을 직접 확인해 주세요.${parsed.excludedCount ? ` 근거가 부족하거나 중복된 ${parsed.excludedCount}개 항목은 제외했습니다.` : ''}` : '확인 가능한 영상 검색 출처가 없습니다. 조건을 바꾸거나 직접 URL을 입력해 주세요.');
      } else if (action.candidate) {
        setReviews(current => ({ ...current, [action.candidate?.videoId ?? '']: text })); setNotice('소개정보 기반 AI 검토를 표시했습니다. 교사가 원문과 영상을 확인해 주세요.');
      }
    } catch (error) {
      if (request === sequence.current && action.identity === identityRef.current) {
        const failure = normalizeChatGptPlanError(error);
        if (action.kind === 'search' && failure.code === 'searchNotPerformed') {
          setResults([]); setReviews({}); setSearched(false);
        }
        setNotice(failure.message);
      }
    }
    finally { if (request === sequence.current) setBusy(false); }
  };
  const open = (url: string) => { void p.onOpenUrl(url).catch(() => setNotice('링크를 열지 못했습니다. 데스크톱 앱에서 다시 시도해 주세요.')); };
  const save = (candidate: AiVideoCandidate) => { void p.onSave(candidate, resultConditions).then(() => setNotice('독립 로컬 라이브러리에 저장했습니다.')).catch(() => setNotice('저장하지 못했습니다. 기존 자료는 유지됩니다.')); };
  const manual = () => {
    const video = canonicalVideoUrl(manualUrl);
    if (!video) { setNotice('유효한 HTTPS YouTube 개별 영상 URL을 입력해 주세요.'); return; }
    const candidate: AiVideoCandidate = { ...video, title: '직접 추가한 영상 · 제목 확인 필요', publisher: null, durationSeconds: null, description: '직접 입력한 URL입니다. 공개 소개정보와 교육 적합성을 교사가 확인해 주세요.', relevance: '직접 확인 필요', reason: '검색 AI가 추천한 영상이 아닙니다.', sources: [{ url: video.url, title: '직접 입력한 영상 URL' }], checkedAt: new Date().toISOString(), needsReview: true };
    setResults([candidate]); setResultConditions({ ...conditions }); setSearched(true); setNotice('직접 입력한 영상입니다. 제목·기관·길이·내용을 확인해 주세요.');
  };
  return <main className="aiv-finder">
    <header className="aiv-header"><div><p className="aiv-eyebrow">BOGUNON DESK / 교육자료</p><h1><Sparkles aria-hidden="true" size={26} />AI 교육영상 Finder</h1><p>교육 조건에 맞는 공개 영상 찾기부터 기안 초안 연결까지</p></div><button type="button" onClick={p.onClose}><ArrowLeft size={16} />보건 업무로</button></header>
    <section className="aiv-account" aria-label="ChatGPT 연결"><div><strong>ChatGPT 요금제 연결</strong><p>{p.connection.state.status === 'connected' ? p.connection.state.email ?? '계정 연결됨' : '연결이 필요합니다.'}</p></div><label>검색 모델<select value={p.connection.selectedModel ?? ''} onChange={event => p.connection.setSelectedModel(event.target.value)}><option value="" disabled>모델 선택</option>{p.connection.models.map(model => <option value={model.slug} key={model.slug}>{model.displayName}</option>)}</select></label><button type="button" onClick={p.onOpenSettings}>AI 연결 설정</button></section>
    <div className="aiv-layout"><section className="aiv-search" aria-labelledby="aiv-search-title"><p className="aiv-eyebrow">01 / 검색 조건</p><h2 id="aiv-search-title">어떤 교육을 준비하시나요?</h2>
      <form onSubmit={event => { event.preventDefault(); prepare('search'); }}><label>교육 주제<input maxLength={200} value={conditions.topic} placeholder="예: 올바른 손씻기와 감염병 예방" onChange={event => setConditions({ ...conditions, topic: event.target.value })} /></label>
        <div className="aiv-topics" aria-label="자주 찾는 주제">{topics.map(topic => <button type="button" key={topic} onClick={() => setConditions({ ...conditions, topic: topic === '직접 입력' ? '' : topic })}>{topic}</button>)}</div>
        <div className="aiv-fields"><label>교육 대상<select value={conditions.target} onChange={event => setConditions({ ...conditions, target: event.target.value })}>{['초등학생', '중학생', '고등학생'].map(target => <option key={target}>{target}</option>)}</select></label><label>희망 영상 길이<select value={conditions.minutes ?? ''} onChange={event => setConditions({ ...conditions, minutes: event.target.value ? Number(event.target.value) : null })}><option value="">제한 없음</option>{[10, 20, 30].map(minutes => <option key={minutes} value={minutes}>{minutes}분 내외</option>)}</select></label></div>
        <label className="aiv-check"><input type="checkbox" checked={conditions.publicFirst} onChange={event => setConditions({ ...conditions, publicFirst: event.target.checked })} />공공기관 자료 우선 검색</label><button className="aiv-primary aiv-search-button" type="submit" disabled={busy || !available || !conditions.topic.trim()}><Search size={17} />{busy ? 'AI 작업 중…' : '교육영상 검색'}</button>
      </form><p className="aiv-muted">검색 조건과 공개 소개정보만 전송합니다. 학생 이름·건강정보 등 개인정보는 입력하지 마세요. 전송 전 내용을 확인합니다.</p><p className="aiv-muted">ChatGPT 요금제의 사용량 제한이 적용될 수 있습니다. 추가 비용·사용량은 계정 및 모델 정책에서 확인해 주세요.</p>
      {!available && <p className="aiv-warning">현재 연결 또는 모델은 웹 검색을 지원하지 않습니다. AI 연결 설정을 확인하거나 영상 URL을 직접 추가해 주세요.</p>}
      <details className="aiv-manual"><summary>영상 URL 직접 추가</summary><label>YouTube 영상 URL<input type="url" value={manualUrl} onChange={event => setManualUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label><button type="button" disabled={busy} onClick={manual}>URL 확인 후 추가</button></details>
    </section><section className="aiv-results" aria-labelledby="aiv-results-title"><div className="aiv-results-heading"><div><p className="aiv-eyebrow">02 / 비교와 선택</p><h2 id="aiv-results-title">{searched ? '교육영상 후보' : '교사의 선택을 돕는 영상 검색'}</h2></div><span>{results.length}개</span></div>
      <p className="aiv-status" role="status" aria-live="polite">{notice}</p><p className="aiv-muted">AI 요약은 원문 소개나 영상 전체 분석 결과가 아닙니다. 공공기관 우선 검색은 공식 채널·교육 적합성 인증이 아닙니다.</p>
      {results.length === 0 && <div className="aiv-empty"><Search size={30} aria-hidden="true" /><h3>{searched ? '조건을 바꿔 다시 찾아보세요' : '검색 조건을 정하고 후보를 비교하세요'}</h3><p>출처가 확인되는 영상만 표시합니다. 제목·길이·기관이 불확실하면 직접 확인이 필요하다고 표시합니다.</p></div>}
      <AiVideoFinderCards candidates={results} busy={busy} canReview={available} reviews={reviews} onOpen={open} onReview={candidate => prepare('review', candidate)} onSave={save} onDraft={candidate => p.onDraft(candidateDraftInput(candidate, resultConditions))} />
      {(p.saved?.length ?? 0) > 0 && <details className="aiv-saved"><summary>저장된 AI 후보 {p.saved?.length}개</summary>{p.saved?.map(saved => <button key={saved.candidate.videoId} type="button" onClick={() => { setResults([saved.candidate]); setSearched(true); setResultConditions(saved.conditions); setConditions(saved.conditions); setNotice('저장된 교육 주제·대상을 불러왔습니다. 내용을 확인한 뒤 기안으로 연결해 주세요.'); }}>{saved.candidate.title}</button>)}</details>}
    </section></div>
    {pending && <OfficialDocumentAiConfirmation key={`${pending.kind}:${pending.prompt}`} confirmation={{ outboundText: pending.prompt, providerLabel: `ChatGPT (${p.connection.selectedModel ?? ''})` }} onCancel={() => setPending(null)} onConfirm={({ outboundText }) => { void confirm(outboundText); }} />}
  </main>;
}
