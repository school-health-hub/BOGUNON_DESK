import { BookOpenCheck, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  OfficialDocumentReference,
  OfficialDocumentReferenceLoadResult,
  OfficialDocumentReferenceRepository,
} from "../../official-document/referenceTypes";

type OfficialDocumentReferencePickerProps = {
  readonly repository: OfficialDocumentReferenceRepository;
  readonly selected: OfficialDocumentReference | null;
  readonly applied?: OfficialDocumentReference | null;
  readonly onSelect: (reference: OfficialDocumentReference) => void;
  readonly onApply: (reference: OfficialDocumentReference) => void;
};

const initialResult: OfficialDocumentReferenceLoadResult = { status: "notConnected" };

export function OfficialDocumentReferencePicker({ repository, selected, applied = null, onSelect, onApply }: OfficialDocumentReferencePickerProps) {
  const [result, setResult] = useState<OfficialDocumentReferenceLoadResult>(initialResult);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState("");
  const [workArea, setWorkArea] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void repository.list()
      .then((next) => {
        if (!active) return;
        setResult(next);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setResult({ status: "error", message: "참고자료를 불러오지 못했습니다." });
        setLoading(false);
      });
    return () => { active = false; };
  }, [repository]);

  const references = result.status === "ready" ? result.references : [];
  const purposes = useMemo(() => [...new Set(references.map((reference) => reference.purposeLabel))], [references]);
  const workAreas = useMemo(() => [...new Set(references.map((reference) => reference.workAreaLabel))], [references]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filtered = references.filter((reference) => (
    (purpose === "" || reference.purposeLabel === purpose)
    && (workArea === "" || reference.workAreaLabel === workArea)
    && (normalizedQuery === "" || `${reference.title} ${reference.description}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))
  ));

  return (
    <section className="official-reference" aria-labelledby="official-reference-title">
      <header className="official-reference__header">
        <div><BookOpenCheck size={17} /><span><strong id="official-reference-title">공문 참고자료</strong><small>{import.meta.env.DEV ? "합성자료 · 개발 전용" : "NOT_CONNECTED"}</small></span></div>
        <span className={`official-reference__status is-${result.status}`}>{loading ? "확인 중" : result.status === "ready" ? `${references.length}건 사용 가능` : "참고자료 연결 전"}</span>
      </header>
      {loading ? <p className="official-reference__notice">참고자료 상태를 확인하고 있습니다.</p> : null}
      {!loading && result.status === "notConnected" ? <p className="official-reference__notice">Phase 1B 연결 전까지 실제 Google 참고자료는 표시되지 않습니다.</p> : null}
      {!loading && result.status === "error" ? <p className="official-reference__error" role="alert">{result.message}</p> : null}
      {!loading && result.status === "empty" ? <p className="official-reference__notice">사용 가능한 참고자료가 없습니다.</p> : null}
      {result.status === "ready" ? (
        <div className="official-reference__workspace">
          <div className="official-reference__browse">
            <label className="official-reference__search"><span><Search size={14} />참고자료 검색</span><input aria-label="참고자료 검색" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="자료명 또는 설명" /></label>
            <div className="official-reference__filters">
              <label><span>문서 목적</span><select value={purpose} onChange={(event) => setPurpose(event.currentTarget.value)}><option value="">전체</option>{purposes.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>업무 분야</span><select value={workArea} onChange={(event) => setWorkArea(event.currentTarget.value)}><option value="">전체</option>{workAreas.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <div className="official-reference__list" role="group" aria-label="참고자료 검색 결과">
              {filtered.map((reference) => <button type="button" aria-pressed={selected?.id === reference.id} className={selected?.id === reference.id ? "is-selected" : ""} key={reference.id} onClick={() => onSelect(reference)}><strong>{reference.title}</strong><span>{reference.purposeLabel} · {reference.workAreaLabel}</span><small>{reference.description || "설명 없음"}</small></button>)}
              {filtered.length === 0 ? <p>검색 조건에 맞는 참고자료가 없습니다.</p> : null}
            </div>
          </div>
          <div className="official-reference__detail" aria-live="polite">
            {selected === null ? <p className="official-reference__empty">자료를 선택하면 내용과 적용 범위를 확인할 수 있습니다.</p> : <>
              <div><span>{selected.purposeLabel}</span><span>{selected.workAreaLabel}</span><span>{selected.dataKind || "본문형"}</span></div>
              <h4>{selected.title}</h4>
              <p className="official-reference__application-state">{applied?.id === selected.id ? "현재 로컬 초안에 적용됨" : "선택됨 · 아직 로컬 초안에 미적용"}</p>
              <p>{selected.description || "설명이 없습니다."}</p>
              <ReferenceBlock title="템플릿 본문" value={selected.templateBody} />
              <ReferenceBlock title="붙임 예시" value={selected.attachmentExample} />
              <ReferenceBlock title="메신저 예시" value={selected.messengerExample} />
              <ReferenceBlock title="기안 전 체크리스트" value={selected.checklist} />
              {selected.tableCopyText ? <ReferenceBlock title="표 복사용 본문" value={selected.tableCopyText} note={selected.tableCopyGuide} /> : null}
              <button className="official-reference__apply" type="button" onClick={() => onApply(selected)}>초안에 적용</button>
            </>}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReferenceBlock({ title, value, note }: { readonly title: string; readonly value: string; readonly note?: string }) {
  if (!value.trim()) return null;
  return <section className="official-reference__block"><strong>{title}</strong><pre>{value}</pre>{note ? <small>{note}</small> : null}</section>;
}
