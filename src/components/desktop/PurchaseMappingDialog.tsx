import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { describePurchaseSourceColumn, getPurchaseMappingErrors, purchaseConfidenceLabels, purchaseRecognitionText, type PurchaseMappingDraft } from "../../purchase/purchaseMappingDraft";
import { purchaseImportFieldIds, purchaseImportFieldLabels, type PurchaseHeaderOption, type PurchaseImportFieldId, type PurchaseMappingCandidate } from "../../purchase/types";

type Props = {
  readonly candidate: PurchaseMappingCandidate;
  readonly option: PurchaseHeaderOption;
  readonly draft: PurchaseMappingDraft;
  readonly busy: boolean;
  readonly remember: boolean;
  readonly templateName: string;
  readonly onHeaderChange: (row: number) => void;
  readonly onFieldChange: (field: PurchaseImportFieldId, index: number | undefined) => void;
  readonly onReapply: () => void;
  readonly onRememberChange: (remember: boolean) => void;
  readonly onTemplateNameChange: (name: string) => void;
  readonly onApply: () => void;
  readonly onClose: () => void;
};

export function PurchaseMappingDialog({ candidate, option, draft, busy, remember, templateName, onHeaderChange, onFieldChange, onReapply, onRememberChange, onTemplateNameChange, onApply, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const composingRef = useRef(false);
  useEffect(() => {
    const trigger = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      else document.querySelector<HTMLElement>(".purchase-helper-panel")?.focus();
    };
  }, []);
  const errors = getPurchaseMappingErrors(draft.mapping, option.headers.length);
  const recommendation = option.recommendation;
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") event.stopPropagation();
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]');
    const first = controls?.[0];
    const last = controls?.[controls.length - 1];
    if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="purchase-mapping-backdrop" onMouseDown={(event) => event.stopPropagation()}>
    <section ref={dialogRef} className="purchase-mapping-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-mapping-title" aria-describedby="purchase-mapping-description" onKeyDown={keyDown} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }}>
      <header><div><h3 id="purchase-mapping-title">열 지정</h3><p id="purchase-mapping-description">추천은 아직 확정되지 않았습니다. 원본과 연결을 확인한 뒤 적용해 주세요.</p></div><button ref={closeRef} type="button" aria-label="열 지정 닫기" onClick={onClose}><X size={17} /></button></header>
      <p className="purchase-mapping-source"><strong>{candidate.sourceName}</strong> · {candidate.sheetName}</p>
      <div className="purchase-mapping-summary"><strong>{purchaseConfidenceLabels[recommendation?.confidence ?? "manual"]}</strong><span>{recommendation === undefined ? "추천 정보가 없습니다. 원본 열을 직접 지정해 주세요." : "분석한 머리글과 데이터를 바탕으로 연결을 추천합니다."}</span>{recommendation !== undefined && <button type="button" disabled={busy} onClick={onReapply}>추천 다시 적용</button>}<small>직접 수정한 항목은 추천을 다시 적용해도 유지됩니다.</small></div>
      {candidate.headerOptions.length > 1 && <label>머리글 행<select aria-label="머리글 행 선택" value={option.rowIndex} onChange={(event) => onHeaderChange(Number(event.target.value))}>{candidate.headerOptions.map((entry) => <option key={entry.rowIndex} value={entry.rowIndex}>{entry.rowIndex + 1}행: {entry.headers.filter(Boolean).join(" | ")}</option>)}</select><small>머리글 행을 바꾸면 해당 행의 추천으로 연결을 새로 시작합니다.</small></label>}
      <div className="purchase-mapping-preview" tabIndex={0} aria-label="원본 데이터 미리보기"><table><tbody>{candidate.rows.slice(option.rowIndex, option.rowIndex + 5).map((row, rowIndex) => <tr key={rowIndex}>{option.headers.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] ?? ""}</td>)}</tr>)}</tbody></table></div>
      <div className="purchase-mapping-fields">{purchaseImportFieldIds.map((field) => {
        const evidence = recommendation?.fields.find((entry) => entry.field === field);
        const manual = draft.touched.includes(field);
        const reasons = [...(evidence?.reasons ?? []), ...(evidence?.warnings ?? [])];
        return <div className="purchase-mapping-field" key={field}><label>{purchaseImportFieldLabels[field]}{field === "name" ? " *" : ""}<select aria-label={`${purchaseImportFieldLabels[field]}에 연결할 원본 열`} value={draft.mapping[field] ?? ""} onChange={(event) => onFieldChange(field, event.target.value === "" ? undefined : Number(event.target.value))}><option value="">사용 안 함</option>{option.headers.map((_, index) => <option key={index} value={index} disabled={Object.entries(draft.mapping).some(([other, value]) => other !== field && value === index)}>{describePurchaseSourceColumn(option.headers, index)}</option>)}</select></label>
          <small>현재 연결: {describePurchaseSourceColumn(option.headers, draft.mapping[field])}{manual && <b className="purchase-mapping-manual">직접 수정</b>}</small>
          <small>추천: {describePurchaseSourceColumn(option.headers, evidence?.columnIndex ?? recommendation?.mapping[field])} · {purchaseConfidenceLabels[evidence?.confidence ?? "manual"]}</small>
          {reasons.length > 0 && <details><summary>추천 근거와 주의사항</summary><ul>{reasons.map((reason, index) => <li key={index}>{purchaseRecognitionText(reason)}</li>)}</ul></details>}
        </div>;
      })}</div>
      {recommendation !== undefined && recommendation.warnings.length > 0 && <div className="purchase-mapping-warnings" role="status">{recommendation.warnings.map((warning, index) => <p key={index}>{purchaseRecognitionText(warning)}</p>)}</div>}
      {errors.length > 0 && <div className="purchase-mapping-warnings" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
      <label className="purchase-mapping-remember"><input type="checkbox" aria-label="이 열 구성을 기억하기" checked={remember} disabled={busy} onChange={(event) => onRememberChange(event.target.checked)} /> 이 열 구성을 기억하기</label>
      {remember && <input aria-label="가져오기 템플릿 이름" maxLength={40} placeholder="예: 학교장터 견적서" value={templateName} disabled={busy} onChange={(event) => onTemplateNameChange(event.target.value)} />}
      <footer><button type="button" onClick={onClose}>취소</button><button type="button" disabled={busy || errors.length > 0} onClick={onApply}>{busy ? "분석 중…" : "적용"}</button></footer>
    </section>
  </div>;
}
