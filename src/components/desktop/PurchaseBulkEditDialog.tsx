import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPurchaseBulkEdits, previewPurchaseBulkEdit, purchaseBulkFields, purchaseSelectionMatches, type PurchaseBulkEdits, type PurchaseBulkField, type PurchaseBulkRequest, type PurchaseFieldEdit } from "../../purchase/purchaseBulkEdit";
import type { PurchaseItem } from "../../purchase/types";

type Props = {
  readonly items: readonly PurchaseItem[];
  readonly revision: number;
  readonly hiddenSelectedCount: number;
  readonly busy: boolean;
  readonly onApply: (request: PurchaseBulkRequest) => void;
  readonly onCancel: () => void;
};
type Review = {
  readonly request: PurchaseBulkRequest;
  readonly count: number;
  readonly hiddenCount: number;
};
const labels: Readonly<Record<PurchaseBulkField, string>> = { vendor: "구매처", budgetItem: "예산항목" };
const describeEdit = (edit: PurchaseFieldEdit): string => {
  switch (edit.mode) {
    case "keep": return "유지";
    case "clear": return "비우기 (기존 값 제거)";
    case "set": return edit.value.trim();
  }
};

export function PurchaseBulkEditDialog({ items, revision, hiddenSelectedCount, busy, onApply, onCancel }: Props) {
  const [edits, setEdits] = useState<PurchaseBulkEdits>(createPurchaseBulkEdits);
  const [review, setReview] = useState<Review | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const composingRef = useRef(false);
  const applyingRef = useRef(false);
  const firstRef = useRef<HTMLSelectElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => { if (review !== null) backRef.current?.focus(); else firstRef.current?.focus(); }, [review]);
  const preview = previewPurchaseBulkEdit(items, edits);
  const count = preview.kind === "valid" ? preview.changes.length : 0;
  const selectedCount = items.filter((item) => item.selected).length;
  const stale = review !== null && (review.request.revision !== revision || !purchaseSelectionMatches(items, review.request.selectedIds));
  const update = (field: PurchaseBulkField, edit: PurchaseFieldEdit) => setEdits((current) => ({ ...current, [field]: edit }));
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") event.stopPropagation();
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
    const first = controls?.[0];
    const last = controls?.[controls.length - 1];
    if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="purchase-name-dialog-backdrop purchase-bulk-backdrop" onMouseDown={(event) => event.stopPropagation()}>
    <section ref={dialogRef} className="purchase-name-dialog purchase-bulk-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-bulk-title" aria-describedby="purchase-bulk-description" onKeyDown={keyDown} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }}>
      <header><div><h3 id="purchase-bulk-title">선택 품목 일괄 편집</h3><p id="purchase-bulk-description">숨겨진 선택 품목도 포함합니다. 기존 품의문은 자동 변경되지 않습니다.</p></div><button type="button" aria-label="일괄 편집 취소" onClick={onCancel}>×</button></header>
      {review === null ? <>
        <p>선택 {selectedCount}개 · 숨겨진 선택 {hiddenSelectedCount}개</p>
        {purchaseBulkFields.map((field, index) => <fieldset key={field}><legend>{labels[field]}</legend>
          <label htmlFor={`purchase-bulk-${field}-mode`}>처리 방식</label>
          <select ref={index === 0 ? firstRef : undefined} id={`purchase-bulk-${field}-mode`} aria-label={`${labels[field]} 처리 방식`} value={edits[field].mode} onChange={(event) => {
            switch (event.target.value) {
              case "keep": update(field, { mode: "keep" }); break;
              case "clear": update(field, { mode: "clear" }); break;
              case "set": update(field, { mode: "set", value: "" }); break;
            }
          }}><option value="keep">유지</option><option value="set">지정</option><option value="clear">비우기</option></select>
          {edits[field].mode === "set" && <label>지정할 {labels[field]}<input aria-label={`일괄 ${labels[field]}`} value={edits[field].value} onChange={(event) => update(field, { mode: "set", value: event.target.value })} /></label>}
          {edits[field].mode === "clear" && <small>선택 품목의 기존 {labels[field]} 값을 제거합니다.</small>}
        </fieldset>)}
        {preview.kind === "invalid" ? <p role="alert">{preview.message}</p> : <p>실제 변경 품목 {count}개</p>}
        <footer><button type="button" onClick={onCancel}>취소</button><button type="button" disabled={busy || count === 0 || selectedCount === 0} onClick={() => setReview({ request: { revision, selectedIds: items.filter((item) => item.selected).map((item) => item.id), edits }, count, hiddenCount: hiddenSelectedCount })}>적용 내용 확인</button></footer>
      </> : <>
        <p>선택 {review.request.selectedIds.length}개 · 숨겨진 선택 {review.hiddenCount}개 · 실제 변경 {review.count}개</p>
        <dl>{purchaseBulkFields.map((field) => <div key={field}><dt>{labels[field]}</dt><dd>{describeEdit(review.request.edits[field])}</dd></div>)}</dl>
        {stale && <p role="alert">대상 품목이 변경되었습니다. 돌아가서 다시 확인해 주세요.</p>}
        <p>기존 값은 덮어쓰거나 비웁니다. 마지막 일괄 적용 1회만 실행 취소할 수 있습니다.</p>
        <footer><button ref={backRef} type="button" onClick={() => { setReview(null); firstRef.current?.focus(); }}>돌아가기</button><button type="button" onClick={onCancel}>취소</button><button type="button" disabled={busy || stale} onClick={() => {
          if (applyingRef.current || composingRef.current || stale || busy) return;
          applyingRef.current = true;
          onApply(review.request);
        }}>{review.count}개 품목에 적용</button></footer>
      </>}
    </section>
  </div>;
}
