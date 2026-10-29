import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Search, Sparkles } from 'lucide-react';
import type { ChatGptConnectionState, ChatGptModel } from '../chatgpt/types';
import type { WebSearchResult } from '../chatgpt/webSearch';
import { normalizeChatGptPlanError } from '../chatgpt/chatgptPlanService';
import { OfficialDocumentAiConfirmation } from '../components/desktop/OfficialDocumentAiConfirmation';
import { prepareOfficialDocumentAiSend } from '../official-document/officialDocumentAiService';
import type { OfficialDocumentInput } from '../official-document/types';
import { AiVideoFinderCards, type ConfirmedCandidateMetadata } from './AiVideoFinderCards';
import { buildYouTubeSearchHandoff, parseTeacherVideoUrls, type TeacherVideoUrlError } from './aiVideoHandoff';
import { buildRecommendationReasonsPrompt, parseRecommendationReasons } from './aiRecommendationReasons';
import { buildVideoReviewPrompt, buildVideoSearchPrompt, candidateDraftInput, parseVideoSearchResult, UNVERIFIED_METADATA_VERIFICATION, type AiVideoCandidate, type SearchConditions } from './aiVideo';
import type { RecommendationReason } from './recommendationReason';
import { AiVideoHandoffConfirmation } from './AiVideoHandoffConfirmation';
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
  readonly enableLiveSearch?: boolean;
  readonly connection: AiFinderConnection;
  readonly onClose: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenUrl: (url: string) => Promise<void>;
  readonly onSave: (candidate: AiVideoCandidate, conditions: SearchConditions, recommendationReason?: RecommendationReason) => Promise<void>;
  readonly onDraft: (input: OfficialDocumentInput) => void;
  readonly saved?: readonly { readonly candidate: AiVideoCandidate; readonly conditions: SearchConditions; readonly recommendationReason?: RecommendationReason }[];
};
type Pending = { readonly prompt: string; readonly kind: 'search' | 'review' | 'reasons'; readonly candidate?: AiVideoCandidate; readonly candidateIds?: readonly string[]; readonly conditions: SearchConditions; readonly identity: string };
const topics = ['마약류 예방교육', '양성평등교육', '성폭력 예방교육', '감염병 예방교육', '생명존중교육', '응급처치교육', '직접 입력'];

export function AiVideoFinder(p: Props) {
  const liveSearchEnabled = p.enableLiveSearch === true;
  const [conditions, setConditions] = useState<SearchConditions>({ topic: '', target: '초등학생', minutes: 10, publicFirst: true });
  const [results, setResults] = useState<readonly AiVideoCandidate[]>([]);
  const [resultConditions, setResultConditions] = useState(conditions);
  const [candidateConditions, setCandidateConditions] = useState<Readonly<Record<string, SearchConditions>>>({});
  const [reviews, setReviews] = useState<Readonly<Record<string, string>>>({});
  const [recommendationReasons, setRecommendationReasons] = useState<Readonly<Record<string, RecommendationReason>>>({});
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<readonly string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState('교육 조건을 입력하면 실제 공개 영상의 검색 출처를 찾아 비교합니다.');
  const [manualUrl, setManualUrl] = useState('');
  const [manualErrors, setManualErrors] = useState<readonly TeacherVideoUrlError[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [searchFailure, setSearchFailure] = useState(false);
  const [handoffConfirm, setHandoffConfirm] = useState(false);
  const [handoffOpenFailed, setHandoffOpenFailed] = useState(false);
  const handoffTriggerRef = useRef<HTMLButtonElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const identity = `${p.connection.state.status}:${p.connection.state.email ?? ''}:${p.connection.selectedModel ?? ''}:${p.connection.state.planUsageEnabled}:${p.connection.supportsWebSearch}:${p.connection.state.isDisconnecting}:${p.connection.state.isSigningIn}`;
  const identityRef = useRef(identity);
  const sequence = useRef(0);
  identityRef.current = identity;
  useEffect(() => {
    sequence.current += 1; setPending(null); setBusy(false); setResults([]); setCandidateConditions({}); setReviews({}); setRecommendationReasons({}); setSelectedCandidateIds([]); setSearched(false); setSearchFailure(false);
    return () => { sequence.current += 1; };
  }, [identity]);
  const available = liveSearchEnabled && p.connection.state.status === 'connected' && p.connection.supportsWebSearch;
  const canGenerateText = p.connection.state.status === 'connected';
  const handoff = useMemo(() => {
    try { return buildYouTubeSearchHandoff(conditions); } catch { return null; }
  }, [conditions]);
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
  const prepareReasons = () => {
    if (p.connection.state.status !== 'connected') { setNotice('추천 이유를 정리하려면 ChatGPT 계정을 연결해 주세요.'); return; }
    const selected = results.filter(candidate => selectedCandidateIds.includes(candidate.videoId));
    try {
      const prompt = buildRecommendationReasonsPrompt(selected.map(candidate => ({ candidate, conditions: candidateConditions[candidate.videoId] ?? resultConditions })));
      const checked = prepareOfficialDocumentAiSend({ outboundText: prompt, generate: async () => '' });
      if (checked.status === 'blocked') { setNotice(checked.error); return; }
      checked.gate.cancel();
      setPending({ kind: 'reasons', candidateIds: selected.map(candidate => candidate.videoId), prompt, conditions: { ...conditions }, identity });
    } catch { setNotice('추천 이유를 정리할 후보를 1~5개 선택해 주세요.'); }
  };
  const confirm = async (outboundText: string) => {
    const action = pending;
    if (!action || action.identity !== identityRef.current || (action.kind === 'search' ? !available : !canGenerateText)) { setPending(null); return; }
    let webResult: WebSearchResult | null = null;
    const prepared = prepareOfficialDocumentAiSend({ outboundText, generate: async prompt => {
      if (action.kind === 'review' || action.kind === 'reasons') return p.connection.generateText(prompt);
      const found = await p.connection.searchWeb(prompt); webResult = found; return found.text;
    } });
    if (prepared.status === 'blocked') { setNotice(prepared.error); return; }
    const request = ++sequence.current;
    setPending(null); setBusy(true); setNotice(action.kind === 'search' ? '공개 교육영상의 검색 출처를 찾고 있습니다…' : action.kind === 'reasons' ? '선택한 후보의 추천 이유를 정리하고 있습니다…' : '공개 소개정보를 검토하고 있습니다…');
    if (action.kind === 'search') {
      const retained = results.filter(candidate => candidate.provenance !== 'web-search-verified');
      setSearchFailure(false);
      setResults(retained);
      setSelectedCandidateIds(current => current.filter(id => retained.some(candidate => candidate.videoId === id)));
      setRecommendationReasons(current => Object.fromEntries(retained.flatMap(candidate => current[candidate.videoId] === undefined ? [] : [[candidate.videoId, current[candidate.videoId]] as const])));
      setCandidateConditions(current => Object.fromEntries(retained.flatMap(candidate => current[candidate.videoId] ? [[candidate.videoId, current[candidate.videoId]] as const] : [])));
    }
    try {
      const text = await prepared.gate.confirm();
      if (request !== sequence.current || action.identity !== identityRef.current || text === null) return;
      if (action.kind === 'search' && webResult !== null) {
        const parsed = parseVideoSearchResult(webResult);
        const retained = results.filter(candidate => candidate.provenance !== 'web-search-verified');
        const added = parsed.candidates.filter(candidate => !retained.some(existing => existing.videoId === candidate.videoId));
        setResults([...retained, ...added]);
        setCandidateConditions(current => ({
          ...Object.fromEntries(retained.flatMap(candidate => current[candidate.videoId] ? [[candidate.videoId, current[candidate.videoId]] as const] : [])),
          ...Object.fromEntries(added.map(candidate => [candidate.videoId, action.conditions])),
        }));
        setResultConditions(action.conditions); setSearched(true); setReviews({});
        setNotice(parsed.candidates.length ? `${parsed.candidates.length}개 후보를 찾았습니다. 원문과 교육 적합성을 직접 확인해 주세요.${parsed.excludedCount ? ` 근거가 부족하거나 중복된 ${parsed.excludedCount}개 항목은 제외했습니다.` : ''}` : '확인 가능한 영상 검색 출처가 없습니다. 조건을 바꾸거나 직접 URL을 입력해 주세요.');
      } else if (action.kind === 'reasons' && action.candidateIds) {
        try {
          const parsed = parseRecommendationReasons(text, action.candidateIds);
          setRecommendationReasons(current => ({ ...current, ...Object.fromEntries(Object.entries(parsed).map(([candidateId, text]) => [candidateId, { status: 'ai-generated' as const, text }])) }));
          setNotice(`${action.candidateIds.length}개 후보의 AI 추천 이유를 표시했습니다. 내용을 수정하거나 삭제할 수 있습니다.`);
        } catch {
          setNotice('추천 이유 응답을 확인할 수 없습니다. 기존 후보 정보는 유지됩니다.');
        }
      } else if (action.candidate) {
        setReviews(current => ({ ...current, [action.candidate?.videoId ?? '']: text })); setNotice('소개정보 기반 AI 검토를 표시했습니다. 교사가 원문과 영상을 확인해 주세요.');
      }
    } catch (error) {
      if (request === sequence.current && action.identity === identityRef.current) {
        const failure = normalizeChatGptPlanError(error);
        if (action.kind === 'search') { setReviews({}); setSearched(true); setSearchFailure(true); }
        setNotice(failure.message);
      }
    }
    finally { if (request === sequence.current) setBusy(false); }
  };
  const open = (url: string) => { void p.onOpenUrl(url).catch(() => setNotice('링크를 열지 못했습니다. 데스크톱 앱에서 다시 시도해 주세요.')); };
  const save = (candidate: AiVideoCandidate) => {
    const currentReason = recommendationReasons[candidate.videoId];
    const reason = currentReason?.status === 'teacher-edited'
      ? currentReason.text.trim() === '' ? { status: 'deleted' as const } : { ...currentReason, text: currentReason.text.trim() }
      : currentReason;
    const saved = reason === undefined
      ? p.onSave(candidate, candidateConditions[candidate.videoId] ?? resultConditions)
      : p.onSave(candidate, candidateConditions[candidate.videoId] ?? resultConditions, reason);
    void saved.then(() => setNotice('독립 로컬 라이브러리에 저장했습니다.')).catch(() => setNotice('저장하지 못했습니다. 기존 자료는 유지됩니다.'));
  };
  const manual = () => {
    const parsed = parseTeacherVideoUrls(manualUrl, results.map(candidate => candidate.videoId));
    const checkedAt = new Date().toISOString();
    const candidates: readonly AiVideoCandidate[] = parsed.videos.map(video => ({ ...video, title: '확인 필요', publisher: null, durationSeconds: null, description: '확인 필요', relevance: '확인 필요', reason: '확인 필요', sources: [{ url: video.url, title: '교사가 입력한 영상 URL' }], checkedAt, needsReview: true, provenance: 'teacher-supplied', metadataVerification: UNVERIFIED_METADATA_VERIFICATION }));
    setManualErrors(parsed.errors);
    if (candidates.length > 0) {
      setResults(current => [...current, ...candidates]); setCandidateConditions(current => ({ ...current, ...Object.fromEntries(candidates.map(candidate => [candidate.videoId, { ...conditions }])) })); setResultConditions({ ...conditions }); setSearched(true);
    }
    const added = candidates.length > 0 ? `${candidates.length}개 영상을 후보에 추가했습니다.` : '추가할 수 있는 새 영상이 없습니다.';
    setNotice(parsed.errors.length > 0 ? `${added} ${parsed.errors.length}개 줄은 아래 오류를 확인해 주세요.` : `${added} 제목·기관·길이·내용을 직접 확인해 주세요.`);
  };
  const confirmMetadata = (candidate: AiVideoCandidate, metadata: ConfirmedCandidateMetadata) => {
    const titleWasConfirmed = candidate.metadataVerification.title === 'teacher-confirmed';
    const publisherWasConfirmed = candidate.metadataVerification.publisher === 'teacher-confirmed';
    const durationWasConfirmed = candidate.metadataVerification.durationSeconds === 'teacher-confirmed';
    const updated: AiVideoCandidate = {
      ...candidate,
      title: metadata.title ?? (titleWasConfirmed || candidate.provenance !== 'teacher-supplied' ? candidate.title : '확인 필요'),
      publisher: metadata.publisher ?? (publisherWasConfirmed ? candidate.publisher : null),
      durationSeconds: metadata.durationSeconds ?? (durationWasConfirmed ? candidate.durationSeconds : null),
      metadataVerification: {
        title: metadata.title !== null || titleWasConfirmed ? 'teacher-confirmed' : 'unverified',
        publisher: metadata.publisher !== null || publisherWasConfirmed ? 'teacher-confirmed' : 'unverified',
        durationSeconds: metadata.durationSeconds !== null || durationWasConfirmed ? 'teacher-confirmed' : 'unverified',
      },
    };
    setResults(current => current.map(item => item.videoId === candidate.videoId ? updated : item));
    setNotice('교사가 확인한 사실정보를 후보에 반영했습니다. 빈 항목은 기존 확인값 또는 확인 필요 상태를 유지합니다.');
  };
  const openManual = () => { setManualOpen(true); window.setTimeout(() => manualRef.current?.focus(), 0); };
  const openHandoff = async () => {
    if (handoff === null) return;
    try { await p.onOpenUrl(handoff.url); setHandoffConfirm(false); setHandoffOpenFailed(false); setNotice('YouTube 검색 결과 페이지를 열었습니다. 선택한 영상 링크를 아래에 붙여넣어 주세요.'); }
    catch { setHandoffOpenFailed(true); setNotice('YouTube 검색 페이지를 열지 못했습니다. 검색 URL을 복사해 브라우저에서 열어 주세요.'); }
  };
  const copyHandoff = async () => {
    if (handoff === null) return;
    try { await navigator.clipboard.writeText(handoff.url); setNotice('YouTube 검색 URL을 복사했습니다.'); }
    catch { setNotice('검색 URL을 복사하지 못했습니다. 화면의 URL을 직접 선택해 복사해 주세요.'); }
  };
  const lowCandidateCount = searched && results.length < 3;
  const candidateWarning = searchFailure
    ? results.length === 0
      ? 'AI 검색 결과를 사용하지 못했습니다. YouTube 검색 또는 직접 링크 입력으로 계속할 수 있습니다.'
      : `AI 검색을 완료하지 못했지만 현재 후보 ${results.length}개는 그대로 사용할 수 있습니다. YouTube 검색 또는 직접 링크 입력으로 후보를 더 추가할 수 있습니다.`
    : lowCandidateCount
      ? results.length === 0
        ? '검색 결과가 없습니다. YouTube 검색 또는 직접 링크 입력으로 계속할 수 있습니다.'
        : `현재 후보가 ${results.length}개입니다. 후보가 3개 미만이어도 선택해 계속 진행할 수 있습니다.`
      : null;
  return <main className="aiv-finder"><div>
      <header className="aiv-header"><div><p className="aiv-eyebrow">BOGUNON DESK / 교육자료</p><h1><Sparkles aria-hidden="true" size={26} />교육영상 Finder</h1><p>교육 조건에 맞는 영상을 직접 찾고 확인한 뒤 기안 초안으로 연결하세요.</p></div><button type="button" onClick={p.onClose}><ArrowLeft size={16} />보건 업무로</button></header>
      <section className="aiv-account" aria-label="AI 추천 이유 연결"><div><strong>선택 기능 · AI 추천 이유</strong><p>{p.connection.state.status === 'connected' ? p.connection.state.email ?? '계정 연결됨' : 'AI 추천 이유를 사용하려면 연결이 필요합니다.'}</p></div><label>AI 모델<select value={p.connection.selectedModel ?? ''} onChange={event => p.connection.setSelectedModel(event.target.value)}><option value="" disabled>모델 선택</option>{p.connection.models.map(model => <option value={model.slug} key={model.slug}>{model.displayName}</option>)}</select></label><button type="button" onClick={p.onOpenSettings}>AI 연결 설정</button></section>
    <div className="aiv-layout"><section className="aiv-search" aria-labelledby="aiv-search-title"><p className="aiv-eyebrow">01 / 검색 조건</p><h2 id="aiv-search-title">어떤 교육을 준비하시나요?</h2>
        <form onSubmit={event => { event.preventDefault(); if (liveSearchEnabled) prepare('search'); }}><label>교육 주제<input ref={topicRef} maxLength={200} value={conditions.topic} placeholder="예: 올바른 손씻기와 감염병 예방" onChange={event => setConditions({ ...conditions, topic: event.target.value })} /></label>
        <div className="aiv-topics" aria-label="자주 찾는 주제">{topics.map(topic => <button type="button" key={topic} onClick={() => setConditions({ ...conditions, topic: topic === '직접 입력' ? '' : topic })}>{topic}</button>)}</div>
        <div className="aiv-fields"><label>교육 대상<select value={conditions.target} onChange={event => setConditions({ ...conditions, target: event.target.value })}>{['초등학생', '중학생', '고등학생'].map(target => <option key={target}>{target}</option>)}</select></label><label>희망 영상 길이<select value={conditions.minutes ?? ''} onChange={event => setConditions({ ...conditions, minutes: event.target.value ? Number(event.target.value) : null })}><option value="">제한 없음</option>{[10, 20, 30].map(minutes => <option key={minutes} value={minutes}>{minutes}분 내외</option>)}</select></label></div>
          <label className="aiv-check"><input type="checkbox" checked={conditions.publicFirst} onChange={event => setConditions({ ...conditions, publicFirst: event.target.checked })} />공공기관 자료 우선 검색</label>{liveSearchEnabled && <button className="aiv-primary aiv-search-button" type="submit" disabled={busy || !available || !conditions.topic.trim()}><Search size={17} />{busy ? 'AI 작업 중…' : '교육영상 검색'}</button>}
      </form><p className="aiv-muted">검색 조건과 공개 소개정보만 전송합니다. 학생 이름·건강정보 등 개인정보는 입력하지 마세요. 전송 전 내용을 확인합니다.</p><p className="aiv-muted">ChatGPT 요금제의 사용량 제한이 적용될 수 있습니다. 추가 비용·사용량은 계정 및 모델 정책에서 확인해 주세요.</p>
        {liveSearchEnabled && !available && <p className="aiv-warning">현재 연결 또는 모델은 웹 검색을 지원하지 않습니다. AI 연결 설정을 확인하거나 영상 URL을 직접 추가해 주세요.</p>}
        <section className="aiv-fallback" aria-label="직접 영상 찾기"><h3>영상 찾기</h3><p>검색어를 확인한 뒤 YouTube에서 영상을 고르고, 찾은 링크를 Finder에 등록하세요.</p>{handoff && <p className="aiv-query"><strong>검색어</strong> {handoff.query}</p>}<div><button className="aiv-primary" type="button" ref={handoffTriggerRef} disabled={handoff === null} onClick={() => { setHandoffOpenFailed(false); setHandoffConfirm(true); }}><ExternalLink size={16} />YouTube에서 영상 찾기</button><button type="button" onClick={openManual}>찾은 영상 링크 붙여넣기</button><button type="button" onClick={() => topicRef.current?.focus()}>검색 조건 수정</button></div></section>
      <details className="aiv-manual" open={manualOpen} onToggle={event => setManualOpen(event.currentTarget.open)}><summary>영상 URL 여러 개 직접 추가</summary><label>YouTube 영상 URL 여러 개<textarea ref={manualRef} rows={6} value={manualUrl} onChange={event => setManualUrl(event.target.value)} placeholder={'한 줄에 URL 하나\nhttps://www.youtube.com/watch?v=…\nhttps://youtu.be/…'} /></label><button type="button" disabled={busy || !manualUrl.trim()} onClick={manual}>유효한 영상 추가</button>{manualErrors.length > 0 && <ul className="aiv-url-errors" aria-label="URL 입력 오류">{manualErrors.map(error => <li key={`${error.line}:${error.reason}`}><strong>{error.line}번 줄</strong> {error.reason}</li>)}</ul>}</details>
    </section><section className="aiv-results" aria-labelledby="aiv-results-title"><div className="aiv-results-heading"><div><p className="aiv-eyebrow">02 / 비교와 선택</p><h2 id="aiv-results-title">{searched ? '교육영상 후보' : '교사의 선택을 돕는 영상 검색'}</h2></div><span>{results.length}개</span></div>
      <p className="aiv-status" role="status" aria-live="polite">{notice}</p><p className="aiv-muted">AI 요약은 원문 소개나 영상 전체 분석 결과가 아닙니다. 공공기관 우선 검색은 공식 채널·교육 적합성 인증이 아닙니다.</p>
      {candidateWarning && <p className="aiv-warning">{candidateWarning}</p>}
      {results.length === 0 && <div className="aiv-empty"><Search size={30} aria-hidden="true" /><h3>{searched ? '조건을 바꿔 다시 찾아보세요' : '검색 조건을 정하고 후보를 비교하세요'}</h3><p>출처가 확인되는 영상만 표시합니다. 제목·길이·기관이 불확실하면 직접 확인이 필요하다고 표시합니다.</p></div>}
      {results.length > 0 && <section className="aiv-reason-toolbar" aria-label="AI 추천 이유"><div><strong>추천 이유가 필요한 후보를 선택하세요.</strong><span>선택 {selectedCandidateIds.length}개 · 최대 5개</span></div><button type="button" className="aiv-primary" disabled={busy || !canGenerateText || selectedCandidateIds.length < 1 || selectedCandidateIds.length > 5} onClick={prepareReasons}>AI로 추천 이유 정리</button></section>}
      <AiVideoFinderCards candidates={results} busy={busy} canReview={available} reviews={reviews} recommendationReasons={recommendationReasons} selectedCandidateIds={selectedCandidateIds} onToggleSelected={candidate => setSelectedCandidateIds(current => current.includes(candidate.videoId) ? current.filter(id => id !== candidate.videoId) : current.length < 5 ? [...current, candidate.videoId] : current)} onReasonChange={(candidate, reason) => setRecommendationReasons(current => ({ ...current, [candidate.videoId]: { status: 'teacher-edited', text: reason } }))} onReasonDelete={candidate => setRecommendationReasons(current => ({ ...current, [candidate.videoId]: { status: 'deleted' } }))} onConfirmMetadata={confirmMetadata} onOpen={open} onReview={candidate => prepare('review', candidate)} onSave={save} onDraft={candidate => p.onDraft(candidateDraftInput(candidate, candidateConditions[candidate.videoId] ?? resultConditions, recommendationReasons[candidate.videoId]))} onRemove={candidate => { setResults(current => current.filter(item => item.videoId !== candidate.videoId)); setSelectedCandidateIds(current => current.filter(id => id !== candidate.videoId)); setCandidateConditions(current => { const { [candidate.videoId]: removed, ...remaining } = current; void removed; return remaining; }); setReviews(current => { const { [candidate.videoId]: removed, ...remaining } = current; void removed; return remaining; }); setRecommendationReasons(current => { const { [candidate.videoId]: removed, ...remaining } = current; void removed; return remaining; }); setNotice('후보에서 삭제했습니다. 저장된 라이브러리는 변경하지 않았습니다.'); }} />
      {(p.saved?.length ?? 0) > 0 && <details className="aiv-saved"><summary>저장된 AI 후보 {p.saved?.length}개</summary>{p.saved?.map(saved => <button key={saved.candidate.videoId} type="button" disabled={busy} onClick={() => { setResults([saved.candidate]); setCandidateConditions({ [saved.candidate.videoId]: saved.conditions }); setReviews({}); setRecommendationReasons(saved.recommendationReason ? { [saved.candidate.videoId]: saved.recommendationReason } : {}); setSelectedCandidateIds([]); setSearched(true); setResultConditions(saved.conditions); setConditions(saved.conditions); setNotice('저장된 교육 주제·대상을 불러왔습니다. 내용을 확인한 뒤 기안으로 연결해 주세요.'); }}>{saved.candidate.title}</button>)}</details>}
    </section></div>
    </div>
    {pending && <OfficialDocumentAiConfirmation key={`${pending.kind}:${pending.prompt}`} confirmation={{ outboundText: pending.prompt, providerLabel: `ChatGPT (${p.connection.selectedModel ?? ''})` }} onCancel={() => setPending(null)} onConfirm={({ outboundText }) => { void confirm(outboundText); }} />}
    {handoffConfirm && handoff && <AiVideoHandoffConfirmation query={handoff.query} url={handoff.url} openFailed={handoffOpenFailed} returnFocus={handoffTriggerRef.current} onCancel={() => setHandoffConfirm(false)} onOpen={() => { void openHandoff(); }} onCopy={() => { void copyHandoff(); }} />}
  </main>;
}
