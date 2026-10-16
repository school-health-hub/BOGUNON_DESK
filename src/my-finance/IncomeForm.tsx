import { useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { FinanceValidationError, type IncomeRecord } from "./domain";
import { deductionLabels, formatKrw, formToIncome, incomeLabels, parseKrw, taxLabels, type IncomeFormValue } from "./presentation";

type Props = { initial: IncomeFormValue; editing: boolean; disabled: boolean; onDirty: () => void; onSave: (entry: IncomeRecord) => void; onCancel: () => void };
export function IncomeForm({ initial, editing, disabled, onDirty, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const source = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => source.current?.focus(), []);
  const change = <K extends keyof IncomeFormValue>(key: K, next: IncomeFormValue[K]) => { setValue((v) => ({ ...v, [key]: next })); setError(null); onDirty(); };
  let net: string = "—";
  try { const amount = parseKrw(value.gross) - value.deductions.reduce((sum, d) => sum + parseKrw(d.amount), 0); if (Number.isSafeInteger(amount) && amount >= 0) net = formatKrw(amount); } catch { /* incomplete form */ }
  return <aside className="finance-form-card" aria-label={editing ? "수입 수정 폼" : "수입 등록 폼"}>
    <header><div><span className="finance-eyebrow">INCOME</span><h2>{editing ? "수입 수정" : "새 수입 등록"}</h2></div><button type="button" className="finance-icon-button" aria-label="입력 취소" disabled={disabled} onClick={onCancel}><X size={18} /></button></header>
    <form onSubmit={(e) => { e.preventDefault(); if (disabled) return; try { onSave(formToIncome(value)); } catch (caught) { setError(caught instanceof FinanceValidationError ? caught.message : "입력 내용을 확인해 주세요."); } }}>
      <fieldset disabled={disabled}>
        <label>지급처<input ref={source} required maxLength={200} value={value.sourceName} onChange={(e) => change("sourceName", e.target.value)} autoComplete="off" /></label>
        <div className="finance-form-pair"><label>수입 유형<select value={value.incomeKind} onChange={(e) => change("incomeKind", e.target.value as IncomeFormValue["incomeKind"])}>{Object.entries(incomeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>계약 명목<input maxLength={200} value={value.contractLabel} onChange={(e) => change("contractLabel", e.target.value)} autoComplete="off" /></label></div>
        <div className="finance-form-pair"><label>수입 발생일<input type="date" required min="1900-01-01" max="9999-12-31" value={value.earnedOn} onChange={(e) => change("earnedOn", e.target.value)} /></label><label>입금일 · 선택<input type="date" min="1900-01-01" max="9999-12-31" value={value.paidOn} onChange={(e) => change("paidOn", e.target.value)} /><small>비워 두면 미입금으로 표시합니다.</small></label></div>
        <label>총수입 (원)<input required type="text" inputMode="numeric" pattern="[0-9]+" value={value.gross} onChange={(e) => change("gross", e.target.value)} autoComplete="off" /><small>쉼표 없이 원 단위 정수로 입력해 주세요.</small></label>
        <section className="finance-deductions" aria-labelledby={`${id}-deductions`}><div className="finance-section-line"><h3 id={`${id}-deductions`}>공제 내역</h3><button type="button" disabled={value.deductions.length >= 100} onClick={() => change("deductions", [...value.deductions, { kind: "other", amount: "" }])}><Plus size={14} /> 공제 추가</button></div>
          {value.deductions.length === 0 && <p className="finance-muted">공제가 없다면 비워 두세요.</p>}
          {value.deductions.map((d, index) => <div className="finance-deduction-row" key={index}>
            <select aria-label={`공제 유형 ${index + 1}`} value={d.kind} onChange={(e) => change("deductions", value.deductions.map((item, i) => i === index ? { ...item, kind: e.target.value as typeof d.kind } : item))}>{Object.entries(deductionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input aria-label={`공제 금액 ${index + 1} (원)`} required inputMode="numeric" pattern="[0-9]+" value={d.amount} onChange={(e) => change("deductions", value.deductions.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} autoComplete="off" />
            <button type="button" className="finance-icon-button" aria-label={`공제 ${index + 1} 삭제`} onClick={() => change("deductions", value.deductions.filter((_, i) => i !== index))}><X size={14} /></button>
          </div>)}
        </section>
        <div className="finance-net-preview"><span>실수령액</span><output aria-label="실수령액 미리보기">{net}</output></div>
        <label>세무 분류<select value={value.taxCategory} onChange={(e) => { change("taxCategory", e.target.value as IncomeFormValue["taxCategory"]); change("taxCategoryVerified", false); }}>{Object.entries(taxLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="finance-checkbox"><input type="checkbox" checked={value.taxCategoryVerified} disabled={value.taxCategory === "unverified" || value.taxCategory === "unknown"} onChange={(e) => change("taxCategoryVerified", e.target.checked)} />증빙을 확인해 세무 분류를 확정했습니다.</label>
        <p className="finance-muted">세무 분류는 공제율로 자동 확정하지 않습니다.</p>
        <label>메모 · 선택<textarea rows={3} maxLength={5000} value={value.notes} onChange={(e) => change("notes", e.target.value)} autoComplete="off" /></label>
      </fieldset>
      {error && <p role="alert" className="finance-error">{error}</p>}
      <div className="finance-form-actions"><button type="button" disabled={disabled} onClick={onCancel}>취소</button><button className="finance-primary" disabled={disabled} type="submit">{editing ? "수정 내용 확인" : "등록 내용 확인"}</button></div>
    </form>
  </aside>;
}
