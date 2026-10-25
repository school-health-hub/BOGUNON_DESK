import { useState } from 'react';
import type { AiVideoCandidate } from './aiVideo';
import { activeRecommendationReason, type RecommendationReason } from './recommendationReason';

export type ConfirmedCandidateMetadata = {
  readonly title: string | null;
  readonly publisher: string | null;
  readonly durationSeconds: number | null;
};

type Props = {
  readonly candidates: readonly AiVideoCandidate[];
  readonly busy: boolean;
  readonly canReview: boolean;
  readonly reviews: Readonly<Record<string, string>>;
  readonly recommendationReasons: Readonly<Record<string, RecommendationReason>>;
  readonly selectedCandidateIds: readonly string[];
  readonly onOpen: (url: string) => void;
  readonly onReview: (candidate: AiVideoCandidate) => void;
  readonly onSave: (candidate: AiVideoCandidate) => void;
  readonly onDraft: (candidate: AiVideoCandidate) => void;
  readonly onRemove: (candidate: AiVideoCandidate) => void;
  readonly onReasonChange: (candidate: AiVideoCandidate, reason: string) => void;
  readonly onReasonDelete: (candidate: AiVideoCandidate) => void;
  readonly onToggleSelected: (candidate: AiVideoCandidate) => void;
  readonly onConfirmMetadata: (candidate: AiVideoCandidate, metadata: ConfirmedCandidateMetadata) => void;
};

const provenanceLabels = {
  'web-search-verified': '검색 출처 확인',
  'teacher-supplied': '교사 입력',
  'teacher-confirmed': '교사 확인',
  'unverified': '확인 필요',
} as const;

function CandidateMetadataEditor({ candidate, busy, onConfirm }: {
  readonly candidate: AiVideoCandidate;
  readonly busy: boolean;
  readonly onConfirm: (metadata: ConfirmedCandidateMetadata) => void;
}) {
  const [title, setTitle] = useState(candidate.metadataVerification.title === 'teacher-confirmed' ? candidate.title : '');
  const [publisher, setPublisher] = useState(candidate.metadataVerification.publisher === 'teacher-confirmed' ? candidate.publisher ?? '' : '');
  const [minutes, setMinutes] = useState(candidate.metadataVerification.durationSeconds === 'teacher-confirmed' && candidate.durationSeconds !== null ? String(Math.floor(candidate.durationSeconds / 60)) : '');
  const [seconds, setSeconds] = useState(candidate.metadataVerification.durationSeconds === 'teacher-confirmed' && candidate.durationSeconds !== null ? String(candidate.durationSeconds % 60) : '');
  const [error, setError] = useState('');
  return <details className="aiv-metadata-editor" aria-label={`${candidate.title} 사실정보 확인·수정`}><summary>사실정보 확인·수정</summary><form onSubmit={event => {
    event.preventDefault();
    const normalizedTitle = title.trim() || null;
    const normalizedPublisher = publisher.trim() || null;
    const hasDuration = minutes !== '' || seconds !== '';
    const durationSeconds = hasDuration ? Number(minutes || '0') * 60 + Number(seconds || '0') : null;
    if (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 86400)) {
      setError('재생시간은 1초 이상 24시간 이하여야 합니다.');
      return;
    }
    setError('');
    onConfirm({ title: normalizedTitle, publisher: normalizedPublisher, durationSeconds });
  }}><p>영상 원문에서 확인한 항목만 입력하세요. 빈칸은 그대로 둡니다.</p><div className="aiv-metadata-fields"><label>확인한 영상 제목<input maxLength={500} value={title} disabled={busy} onChange={event => setTitle(event.currentTarget.value)} /></label><label>확인한 제작기관<input maxLength={500} value={publisher} disabled={busy} onChange={event => setPublisher(event.currentTarget.value)} /></label><label>재생시간 분<input type="number" min="0" max="1440" step="1" inputMode="numeric" value={minutes} disabled={busy} onChange={event => setMinutes(event.currentTarget.value)} /></label><label>재생시간 초<input type="number" min="0" max="59" step="1" inputMode="numeric" value={seconds} disabled={busy} onChange={event => setSeconds(event.currentTarget.value)} /></label></div>{error && <p className="aiv-warning" role="alert">{error}</p>}<button type="submit" disabled={busy}>확인한 정보 적용</button></form></details>;
}

export function AiVideoFinderCards(p: Props) {
  return <ol className="aiv-cards">{p.candidates.map((candidate, index) => <li key={candidate.videoId}>
    <article aria-label={candidate.title}>
      <div className="aiv-card-heading"><label className="aiv-candidate-select"><input type="checkbox" aria-label={`후보 ${index + 1} 선택`} checked={p.selectedCandidateIds.includes(candidate.videoId)} disabled={p.busy} onChange={() => p.onToggleSelected(candidate)} /><span className="aiv-number">{String(index + 1).padStart(2, '0')}</span></label><div>
        <p className="aiv-eyebrow">영상 후보 · {provenanceLabels[candidate.provenance]}</p><h3>{candidate.title}</h3><small className="aiv-title-status">제목 {candidate.metadataVerification.title === 'unverified' ? '확인 필요' : '교사 확인'}</small>
      </div></div>
      <dl className="aiv-metadata"><div><dt>제작기관</dt><dd>{candidate.publisher ?? '원문 확인 필요'}<span className="aiv-field-status">{candidate.metadataVerification.publisher === 'teacher-confirmed' ? '교사 확인' : '확인 필요'}</span></dd></div>
        <div><dt>영상 길이</dt><dd>{candidate.durationSeconds === null ? '원문 확인 필요' : `${Math.floor(candidate.durationSeconds / 60)}분 ${candidate.durationSeconds % 60}초`}<span className="aiv-field-status">{candidate.metadataVerification.durationSeconds === 'teacher-confirmed' ? '교사 확인' : '확인 필요'}</span></dd></div>
        <div><dt>확인 시점</dt><dd><time dateTime={candidate.checkedAt}>{new Date(candidate.checkedAt).toLocaleString('ko-KR')}</time></dd></div></dl>
      <CandidateMetadataEditor key={`${candidate.checkedAt}:${candidate.title}:${candidate.publisher ?? ''}:${candidate.durationSeconds ?? ''}:${candidate.metadataVerification.title}:${candidate.metadataVerification.publisher}:${candidate.metadataVerification.durationSeconds}`} candidate={candidate} busy={p.busy} onConfirm={metadata => p.onConfirmMetadata(candidate, metadata)} />
      {candidate.provenance === 'web-search-verified'
        ? <><p className="aiv-summary-label">공개 소개정보의 AI 요약 · 원문 확인 필요</p><p>{candidate.description}</p><p><strong>주제 관련성</strong> {candidate.relevance}</p><p><strong>추천 이유 / 확인할 점</strong> {candidate.reason}</p></>
        : <><p className="aiv-summary-label">영상 정보 · 원문 확인 필요</p><p>제목·제작기관·재생시간과 교육 적합성은 원문 확인이 필요합니다.</p></>}
      <p className="aiv-video-url">{candidate.url}</p><div className="aiv-source"><span>출처</span>{candidate.sources.map(source => <button type="button" key={source.url} onClick={() => p.onOpen(source.url)}>{source.title}</button>)}</div>
      {p.reviews[candidate.videoId] && <section className="aiv-review" aria-label="AI 검토 내용"><h4>소개정보 기반 AI 검토</h4><p>{p.reviews[candidate.videoId]}</p><small>영상 시청·전체 자막 분석 결과가 아닙니다.</small></section>}
      {p.recommendationReasons[candidate.videoId] !== undefined && p.recommendationReasons[candidate.videoId]?.status !== 'deleted' && <section className="aiv-reason" aria-label={`후보 ${index + 1} AI 추천 이유`}><h4>{p.recommendationReasons[candidate.videoId]?.status === 'teacher-edited' ? '교사 수정 추천 이유' : 'AI 작성 추천 이유'}</h4><textarea maxLength={600} value={activeRecommendationReason(p.recommendationReasons[candidate.videoId]) ?? ''} disabled={p.busy} onChange={event => p.onReasonChange(candidate, event.currentTarget.value)} aria-label={`후보 ${index + 1} AI 추천 이유`} /><small>영상 내용 분석이 아닌, 전송 전 확인한 사실정보와 교육 조건을 바탕으로 작성되었습니다.</small><button type="button" disabled={p.busy} onClick={() => p.onReasonDelete(candidate)}>AI 추천 이유 삭제</button></section>}
      <div className="aiv-actions"><button type="button" onClick={() => p.onOpen(candidate.url)}>영상 열기</button>
        <button type="button" disabled={p.busy || !p.canReview || candidate.provenance !== 'web-search-verified'} onClick={() => p.onReview(candidate)}>AI로 소개정보 검토</button>
        <button type="button" disabled={p.busy} onClick={() => p.onSave(candidate)}>라이브러리 저장</button>
        <button className="aiv-primary" type="button" disabled={p.busy} onClick={() => p.onDraft(candidate)}>기안 초안으로 연결</button>
        <button type="button" disabled={p.busy} onClick={() => p.onRemove(candidate)}>후보 삭제</button></div>
    </article>
  </li>)}</ol>;
}
