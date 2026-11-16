import { useEffect, useMemo, useRef, useState } from 'react';
import { monthlyTopicSchema, parseMonthlyBank, recommendMonthlyTopics, syntheticMonthlyBank, topicKey, type MonthlyTopic } from './monthlyTopicBank';
import type { NewsletterSchoolType } from './newDocument';
import type { NewsletterProject } from './schema';
import './topic-planner.css';
type Props = {
    readonly project: NewsletterProject;
    readonly month: string; readonly closings?:readonly string[];
    readonly onCancel: () => void;
    readonly onApply: (topics: readonly MonthlyTopic[], month: string) => void;
};
export function NewsletterTopicPlanner({ project, month: initialMonth, onCancel, onApply, closings }: Props) {
    const dialog = useRef<HTMLDialogElement>(null), submitted = useRef(false), baseline = useRef(project);
    const [month, setMonth] = useState(initialMonth), [school, setSchool] = useState<NewsletterSchoolType>('coed-high');
    const [bank, setBank] = useState<readonly MonthlyTopic[]>([]), [selected, setSelected] = useState<readonly MonthlyTopic[]>([]);
    const [consent, setConsent] = useState(false), [review, setReview] = useState(false), [ack, setAck] = useState(false), [error, setError] = useState('');
    const [manual, setManual] = useState('');
    const ranked = useMemo(() => recommendMonthlyTopics(bank, month, school), [bank, month, school]);
    useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
    const validMonth = /^20\d{2}-(?:0[1-9]|1[0-2])$/u.test(month);
    const valid = validMonth && selected.length === 6 && new Set(selected.map(topic => topicKey(topic.title))).size === 6 && selected.every(topic => topic.title.trim().length > 0);
    const update = (index: number, patch: Partial<MonthlyTopic>) => setSelected(current => current.map((topic, at) => at === index ? { ...topic, ...patch } : topic));
    const load = (topics: readonly MonthlyTopic[]) => { setBank(topics); setSelected([]); setReview(false); setAck(false); setError('자료를 세션 안에서만 가져왔습니다. 추천 확인 후 주제 6개를 검토해 주세요.'); };
    const importFile = async (file: File) => { try {
        if (file.size > 2097152)
            throw Error('2MiB 이하 JSON을 선택해 주세요.');
        load(parseMonthlyBank(await file.text()));
    }
    catch (failure: unknown) {
        setError(failure instanceof Error ? failure.message : '가져오지 못했습니다. 기존 선택은 유지됩니다.');
    } };
    const toggle = (topic: MonthlyTopic) => { if (selected.some(value => value.id === topic.id)) {
        setSelected(current => current.filter(value => value.id !== topic.id));
        return;
    } if (selected.length >= 6) {
        setError('교체할 주제를 먼저 해제해 주세요. 최대 6개를 선택합니다.');
        return;
    } setSelected(current => [...current, topic]); setError(''); };
    const move = (index: number, delta: number) => setSelected(current => { const next = [...current], other = index + delta; if (other < 0 || other >= next.length)
        return current; const item = next[index], target = next[other]; if (!item || !target)
        return current; next[index] = target; next[other] = item; return next; });
    const add = () => { try {
        const topic = monthlyTopicSchema.parse({ id: `manual-${crypto.randomUUID()}`, title: manual, year: Number(month.slice(0, 4)), month: Number(month.slice(5)), schoolType: school, source: { kind: 'manual', label: '사용자 직접 입력 · 출처 검토 필요', reference: 'manual:unverified' }, reviewStatus: 'pending' });
        if (selected.length >= 6)
            throw Error('주제 하나를 해제한 뒤 추가해 주세요.');
        setSelected(current => [...current, topic]);
        setManual('');
        setError('');
    }
    catch {
        setError('빈 제목 또는 선택 개수를 확인해 주세요.');
    } };
    return <dialog ref={dialog} className="newsletter-topic-planner" aria-labelledby="topic-plan-title" onCancel={event => { event.preventDefault(); onCancel(); }}>
  <header><h2 id="topic-plan-title">월별 주제 6개 고르기</h2><button type="button" onClick={onCancel}>취소 · 현재 문서 유지</button></header>
  <p>로컬 자료를 규칙으로 추천합니다. 외부 AI·클라우드 연결은 사용하지 않습니다. 그림과 기존 revision은 자동 변경하지 않습니다.</p>
  {!review ? <>
   <div className="topic-plan-controls"><label>추천 기준 월<input aria-label="추천 기준 월" type="month" value={month} onChange={event => { setMonth(event.target.value); setSelected([]); }}/></label><label>추천 학교 유형<select aria-label="추천 학교 유형" value={school} onChange={event => { if (event.target.value === 'girls-high' || event.target.value === 'boys-high' || event.target.value === 'coed-high') {
            setSchool(event.target.value);
            setSelected([]);
        } }}><option value="coed-high">남녀공학</option><option value="girls-high">여자고등학교</option><option value="boys-high">남자고등학교</option></select></label></div>
   <small>추천 기준 월을 바꿔도 기존 문서의 발행 정보는 바뀌지 않습니다. 새 소식지는 시작 화면에서 작성 월을 지정해 주세요.</small>
   <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>개인정보가 없고 사용 허가된 로컬 주제 자료만 가져옵니다.</label>
   <div className="topic-plan-controls"><label>주제 은행 JSON 가져오기<input type="file" aria-label="주제 은행 JSON 가져오기" accept=".json,application/json" disabled={!consent} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file)
            void importFile(file); }}/></label><button type="button" disabled={!validMonth} onClick={() => load(syntheticMonthlyBank(month))}>합성 예시로 검토 · 실제 이력 아님</button></div>
   <details><summary>로컬 주제 은행 형식과 보관 안내</summary><p>기존 주제 배열 또는 version: 1, topics: [] 객체를 받습니다. id, title, year, month, schoolType, source(kind·label·reference), reviewStatus가 필요합니다. lead, actions(최대 4개), closing, tags는 선택입니다. 원본 파일과 권한은 변경하지 않으며 앱 종료 시 은행은 사라집니다. 확정한 주제의 출처만 문서 JSON에 남습니다.</p><p>source.kind: local-archive(실제 자료), approved-bank(검토된 은행), local-fixture(합성). 자료의 출판·발행 사실은 사용자가 원본과 대조해야 합니다.</p></details>
   <div className="topic-plan-controls"><strong>후보 {ranked.length}개 · 선택 {selected.length}/6</strong><button type="button" disabled={ranked.length === 0} onClick={() => { setSelected(ranked.slice(0, 6).map(value => value.topic)); setError(''); }}>추천 순서로 최대 6개 선택</button></div>
   {ranked.length < 6 && <p role="status">추천 자료가 {6 - ranked.length}개 부족합니다. 현재 선택 {selected.length}/6 · 추가 선택 {Math.max(0, 6 - selected.length)}개. 다른 자료를 가져오거나 직접 주제를 추가해 주세요. 근거 없는 주제·수칙은 자동 생성하지 않습니다.</p>}
   <ul className="topic-candidates">{ranked.map(({ topic, reason }) => <li key={topic.id}><label><input type="checkbox" checked={selected.some(value => value.id === topic.id)} onChange={() => toggle(topic)}/><strong>{topic.title}</strong></label><small>{reason}</small><details><summary>출처 보기</summary><p>{topic.source.label} · {topic.source.reference}</p><p>{topic.reviewStatus === 'reviewed' ? '자료 검토 표시 있음 · 게시 전 재확인' : '원고·출처 검토 필요'}</p></details></li>)}</ul>
   <div className="topic-plan-controls"><label>직접 주제 제목<input aria-label="직접 주제 제목" maxLength={120} value={manual} onChange={event => setManual(event.target.value)}/></label><button type="button" onClick={add}>직접 주제 추가</button></div>
   <ol className="topic-selection">{selected.map((topic, index) => <li key={topic.id}><div className="topic-plan-controls"><strong>{index + 1}. {topic.title}</strong><button type="button" aria-label={`${index + 1}번 주제 위로`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`${index + 1}번 주제 아래로`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`${index + 1}번 주제 해제`} onClick={() => setSelected(current => current.filter(value => value.id !== topic.id))}>해제·교체</button></div><details><summary>원고 검토·수정{!topic.lead || topic.actions.filter(Boolean).length !== 4 || !topic.closing ? ' · 작성 필요' : ''}</summary><label>주제 제목<input aria-label={`${index + 1}번 주제 제목`} value={topic.title} maxLength={120} onChange={event => update(index, { title: event.target.value })}/></label><label>한 줄 소개<input value={topic.lead} maxLength={1000} onChange={event => update(index, { lead: event.target.value })}/></label>{[0, 1, 2, 3].map(action => <label key={action}>실천 수칙 {action + 1}<input value={topic.actions[action] ?? ''} maxLength={1000} onChange={event => update(index, { actions: Array.from({ length: 4 }, (_, at) => at === action ? event.target.value : topic.actions[at] ?? '') })}/></label>)}<label>마무리 문구<input value={topic.closing} maxLength={1000} onChange={event => update(index, { closing: event.target.value })}/></label><p>출처: {topic.source.label} · {topic.source.reference}</p><small>자료에 없는 건강정보는 채우지 않습니다. 빈 항목은 원고 편집에서 작성해야 하며, 수칙 4개가 없으면 출력 준비가 완료되지 않습니다.</small></details></li>)}</ol>
  </> : <section aria-label="주제 변경 미리보기"><h3>현재 원고 → 적용할 공통 원고</h3>{selected.map((topic, index) => <article key={topic.id}><h4>{index + 1}. {project.topics[index]?.title} → {topic.title}</h4><details><summary>변경 전 공통 원고</summary><pre>{project.canonicalCopy.sections[index]?.userEdit?.text ?? project.canonicalCopy.sections[index]?.aiGenerated.text ?? ""}</pre><p>기존 마무리: {closings?.[index] ?? project.canonicalCopy.sections[index]?.topicSelection?.closing ?? ""}</p></details><p>{topic.lead || '한 줄 소개 작성 필요'}</p><ol>{topic.actions.map((action, at) => <li key={at}>{action || '수칙 작성 필요'}</li>)}</ol><p>{topic.closing || '마무리 문구 작성 필요'}</p><small>출처: {topic.source.label} · {topic.source.reference}</small></article>)}<p>원고·디자인 revision을 각각 하나 추가합니다. 기존 이미지·프리셋·과거 revision·출력 이력은 유지합니다. 학생 그림은 이후 별도 선택하며 승인 대기 출력 제한은 유지됩니다.</p><label><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)}/>6개 주제와 출처·수칙을 검토했으며 새 revision 적용을 확인합니다.</label></section>}
  {error && <p role="status">{error}</p>}
  <footer>{review ? <><button type="button" onClick={() => { setReview(false); setAck(false); }}>이전 · 주제 수정</button><button type="button" disabled={!valid || !ack} onClick={() => { if (submitted.current)
        return; if (project !== baseline.current) {
        setError("편집본이 변경되었습니다. 취소 후 현재 문서에서 다시 검토해 주세요.");
        return;
    } submitted.current = true; onApply(selected, month); }}>공통 원고에 적용 · 새 revision</button></> : <button type="button" disabled={!valid} onClick={() => { setReview(true); setAck(false); dialog.current?.scrollTo({ top: 0 }); }}>6개 주제 변경 미리보기</button>}</footer>
 </dialog>;
}
