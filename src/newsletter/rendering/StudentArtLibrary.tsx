import { useRef, useState } from "react";
import type { NewsletterDesignStateV2 } from "./designSchema";
import { applyStudentArt, artSlots, filterStudentArt, recommendStudentArt } from "./studentArt";
import type { StudentArt } from "./studentArtCatalog";
import { studentArtSource } from "./studentArtSources";
import "./studentArt.css";
type Props = {
    readonly design: NewsletterDesignStateV2;
    readonly mode: "a4" | "cards";
    readonly index: number;
    readonly topic: string;
    readonly assets?: ReadonlyMap<string, string>;
    readonly onChange: (design: NewsletterDesignStateV2) => void;
};
export function StudentArtLibrary({ design, mode, index, topic, assets, onChange }: Props) {
    const dialog = useRef<HTMLDialogElement>(null), base = useRef(design), committed = useRef(false);
    const [type, setType] = useState<"all" | "female" | "male" | "mixed">("all"), [recommended, setRecommended] = useState(false);
    const [enlarged, setEnlarged] = useState(false);
    const [choice, setChoice] = useState<string | null | undefined>(), [slotKey, setSlotKey] = useState(""), [error, setError] = useState(""), [review, setReview] = useState(false);
    const slots = artSlots(design, mode, index), slot = slots.find(s => s.key === slotKey) ?? slots[0];
    const matches = new Set(recommendStudentArt(topic).map(a => a.id));
    const candidates = filterStudentArt(type).filter(a => !recommended || matches.has(a.id));
    const groups = new Map<string, typeof candidates>();
    for (const a of candidates)
        groups.set(a.family, [...(groups.get(a.family) ?? []), a]);
    const selected = filterStudentArt("all").find(a => a.id === choice);
    function tile(a:StudentArt){const bound=design.assetManifest.find(asset=>asset.id===slot?.assetId);return <button type="button" key={a.id} aria-pressed={choice===a.id} onClick={()=>setChoice(a.id)}><img loading="lazy" src={studentArtSource(a.sha256)} alt={a.family+" · "+a.variant}/><span>{a.variant} · {a.width}×{a.height}</span><small>{a.id} · 승인 대기{bound?.sha256===a.sha256?" · 현재 적용":""}</small></button>}
    function open() { base.current = design; committed.current = false; setChoice(undefined); setError(""); setReview(false); setEnlarged(false); dialog.current?.showModal(); }
    function confirm() {
        if (committed.current)
            return;
        if (base.current !== design) {
            setError("편집본이 변경됐습니다. 닫고 다시 비교해 주세요.");
            return;
        }
        if (!slot || choice === undefined || choice !== null && !review)
            return;
        try {
            const next = applyStudentArt(design, slot.target, choice, new Date().toISOString());
            committed.current = true;
            onChange(next);
            dialog.current?.close();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : "그림 적용에 실패했습니다.");
        }
    }
    return <section className="student-art-entry"><button type="button" onClick={open} disabled={slots.length === 0}>학생 삽화 선택</button><small>선택한 슬롯만 변경 · 출판 승인 대기 자산</small>
 <dialog ref={dialog} className="student-art-dialog" aria-labelledby="student-art-title"><header><h2 id="student-art-title">학생 삽화 선택</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="삽화 선택 닫기">닫기</button></header>
 <p role="note">기존 20개 그림은 검수용 후보입니다. 출판 승인이 없으므로 PNG·PDF 출판 출력은 차단됩니다. 필터를 바꿔도 현재 그림은 유지됩니다.</p>
 <label>적용 대상<select value={slot?.key ?? ""} onChange={e => setSlotKey(e.target.value)}>{slots.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
 <nav aria-label="학생 유형">{(["all", "female", "male", "mixed"] as const).map((v, i) => <button type="button" key={v} aria-pressed={type === v} onClick={() => setType(v)}>{["전체", "여학생", "남학생", "혼합"][i]}</button>)}
 <label className="student-art-check"><input type="checkbox" checked={recommended} onChange={e => setRecommended(e.target.checked)}/>현재 주제 추천 (장면 태그 기준)</label></nav>
 <button type="button" aria-pressed={choice === null} onClick={() => setChoice(null)}>학생 없음 · 해당 슬롯의 그림 미사용</button>
 <div className="student-art-grid">{[...groups].map(([family,list])=><article key={family}><h3>{family}</h3>{list[0]&&tile(list[0])}{list.length>1&&<details><summary>같은 장면의 파생·크롭 {list.length-1}개</summary>{list.slice(1).map(tile)}</details>}</article>)}</div>
 {candidates.length === 0 && <p role="status">해당 주제·유형의 추천 그림이 없습니다. 전체 라이브러리에서 선택해 주세요.</p>}
 {choice !== undefined && <section className="student-art-compare" aria-label="변경 전후 비교"><figure><figcaption>현재 · {slot?.label}</figcaption>{slot?.assetId && assets?.get(slot.assetId) ? <img src={assets.get(slot.assetId)} alt="현재 그림"/> : <p>미지정 그림 또는 기본 도형</p>}</figure><figure><figcaption>변경 후 · {selected?.family ?? "학생 없음"}</figcaption>{selected ? <button type="button" className={enlarged ? "student-art-enlarged" : ""} onClick={() => setEnlarged(v => !v)} aria-label={enlarged ? "그림 축소" : "그림 확대"}><img src={studentArtSource(selected.sha256)} alt="선택한 그림 확대"/></button> : <p>그림 미사용</p>}</figure></section>}
 {selected && <label className="student-art-check"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)}/>승인 대기 그림을 검수용 편집본에서만 확인합니다.</label>}
 {error && <p role="alert">{error}</p>}<footer><button type="button" onClick={() => dialog.current?.close()}>취소 · 현재 문서 유지</button><button type="button" disabled={choice === undefined || choice !== null && !review || !slot} onClick={confirm}>비교한 슬롯에 적용 · 새 revision</button></footer></dialog></section>;
}
