import type { AiVideoCandidate } from './aiVideo';

type Props = {
  readonly candidates: readonly AiVideoCandidate[];
  readonly busy: boolean;
  readonly canReview: boolean;
  readonly reviews: Readonly<Record<string, string>>;
  readonly onOpen: (url: string) => void;
  readonly onReview: (candidate: AiVideoCandidate) => void;
  readonly onSave: (candidate: AiVideoCandidate) => void;
  readonly onDraft: (candidate: AiVideoCandidate) => void;
};

export function AiVideoFinderCards(p: Props) {
  return <ol className="aiv-cards">{p.candidates.map((candidate, index) => <li key={candidate.videoId}>
    <article aria-label={candidate.title}>
      <div className="aiv-card-heading"><span className="aiv-number">{String(index + 1).padStart(2, '0')}</span><div>
        <p className="aiv-eyebrow">영상 후보 · 교사 검토 필요</p><h3>{candidate.title}</h3>
      </div></div>
      <dl className="aiv-metadata"><div><dt>제작기관</dt><dd>{candidate.publisher ?? '원문 확인 필요'}</dd></div>
        <div><dt>영상 길이</dt><dd>{candidate.durationSeconds === null ? '원문 확인 필요' : `${Math.floor(candidate.durationSeconds / 60)}분 ${candidate.durationSeconds % 60}초`}</dd></div>
        <div><dt>확인 시점</dt><dd><time dateTime={candidate.checkedAt}>{new Date(candidate.checkedAt).toLocaleString('ko-KR')}</time></dd></div></dl>
      <p className="aiv-summary-label">공개 소개정보의 AI 요약 · 원문 확인 필요</p><p>{candidate.description}</p>
      <p><strong>주제 관련성</strong> {candidate.relevance}</p><p><strong>추천 이유 / 확인할 점</strong> {candidate.reason}</p>
      <p className="aiv-video-url">{candidate.url}</p><div className="aiv-source"><span>출처</span>{candidate.sources.map(source => <button type="button" key={source.url} onClick={() => p.onOpen(source.url)}>{source.title}</button>)}</div>
      {p.reviews[candidate.videoId] && <section className="aiv-review" aria-label="AI 검토 내용"><h4>소개정보 기반 AI 검토</h4><p>{p.reviews[candidate.videoId]}</p><small>영상 시청·전체 자막 분석 결과가 아닙니다.</small></section>}
      <div className="aiv-actions"><button type="button" onClick={() => p.onOpen(candidate.url)}>영상 열기</button>
        <button type="button" disabled={p.busy || !p.canReview} onClick={() => p.onReview(candidate)}>AI로 소개정보 검토</button>
        <button type="button" disabled={p.busy} onClick={() => p.onSave(candidate)}>라이브러리 저장</button>
        <button className="aiv-primary" type="button" disabled={p.busy} onClick={() => p.onDraft(candidate)}>기안 초안으로 연결</button></div>
    </article>
  </li>)}</ol>;
}
