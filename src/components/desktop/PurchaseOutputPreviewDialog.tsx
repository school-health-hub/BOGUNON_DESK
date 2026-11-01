import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { purchaseOutputPreviewLabels, type PurchaseOutputPreviewSnapshot } from "../../purchase/purchaseOutputPreview";

type Props = {
  readonly snapshot: PurchaseOutputPreviewSnapshot;
  readonly currentKey: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onOutput: () => void;
};

export function PurchaseOutputPreviewDialog({ snapshot, currentKey, busy = false, onClose, onOutput }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stale = currentKey !== snapshot.key;
  const disabled = stale || busy || snapshot.blocked.length > 0;
  const label = purchaseOutputPreviewLabels[snapshot.kind];
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(sectionRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return <div className="purchase-name-dialog-backdrop purchase-output-preview-backdrop" onMouseDown={(event) => {
    if (event.currentTarget === event.target) onClose();
  }}>
    <section ref={sectionRef} className="purchase-name-dialog purchase-output-preview-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={handleKeyDown}>
      <header>
        <div><h3 id={titleId}>{label} 미리보기</h3><p id={descriptionId}>선택 {snapshot.selectedCount}건 · 현재 필터에서 숨겨진 선택 {snapshot.hiddenCount}건 · 실제 출력 {snapshot.table.rows.length}행</p></div>
        <button ref={closeRef} type="button" aria-label="미리보기 닫기" onClick={onClose}><X size={17} /></button>
      </header>
      <dl className="purchase-output-preview-summary">
        <div><dt>선택 품의금액</dt><dd>{snapshot.plannedTotal.toLocaleString("ko-KR")}원</dd></div>
        {snapshot.guidance.map(({ name, value }, index) => <div key={`${name}-${index}`}><dt>{name}</dt><dd>{value}</dd></div>)}
      </dl>
      {stale && <p role="alert">품목 또는 출력 설정이 변경되었습니다. 닫은 뒤 미리보기를 다시 열어 주세요.</p>}
      {snapshot.blocked.map((reason, index) => <p role="alert" key={index}>{reason}</p>)}
      <div className="purchase-output-preview-table-scroll" tabIndex={0} role="region" aria-label="실제 출력 표">
        <table>
          <caption>{label} · 실제 출력 {snapshot.table.rows.length}행 · {snapshot.table.headers.length}열</caption>
          <thead><tr>{snapshot.table.headers.map((header, index) => <th scope="col" key={index}>{header}</th>)}</tr></thead>
          <tbody>{snapshot.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={columnIndex}>{value ?? ""}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <footer>
        <button type="button" onClick={onClose}>닫기</button>
        <button type="button" disabled={disabled} onClick={() => { if (!disabled) onOutput(); }}>{busy ? "출력 중…" : "확인한 내용으로 출력"}</button>
      </footer>
    </section>
  </div>;
}
