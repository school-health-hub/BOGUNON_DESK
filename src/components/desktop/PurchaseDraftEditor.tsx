import { ArrowDown, ArrowUp, ClipboardCopy, FileText, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { createPurchaseDraftClipboard, createPurchaseDraftText, defaultPurchaseDraftTemplate } from "../../purchase/purchaseDraft";
import {
  type PurchaseDraft,
  type PurchaseDraftDetailFieldId,
  type PurchaseDraftTemplate,
  type PurchaseItem,
  type PurchaseOutputColumnId,
} from "../../purchase/types";

type Props = {
  readonly columns: readonly PurchaseOutputColumnId[];
  readonly draft: PurchaseDraft;
  readonly items: readonly PurchaseItem[];
  readonly outputReady: boolean;
  readonly templates: readonly PurchaseDraftTemplate[];
  readonly onChange: (draft: PurchaseDraft) => void;
  readonly onNotice: (message: string) => void;
  readonly onTemplatesChange: (templates: readonly PurchaseDraftTemplate[]) => void;
};

const detailLabels: Readonly<Record<PurchaseDraftDetailFieldId, string>> = {
  summary: "구매내용",
  amount: "구매금액",
  vendor: "구매처",
  budgetItem: "예산항목",
};

const createRuntimeTemplate = (draft: PurchaseDraft): PurchaseDraftTemplate => ({
  id: draft.templateId,
  name: "현재 문서 형식",
  titlePattern: draft.titlePattern,
  introPattern: draft.introPattern,
  detailFieldOrder: draft.detailFieldOrder,
  attachmentPhrase: draft.attachmentPhrase,
  includeAttachment: draft.includeAttachment,
});

const writeClipboard = async (content: { readonly text: string; readonly html: string }, rich: boolean): Promise<void> => {
  if (rich && typeof ClipboardItem !== "undefined" && navigator.clipboard.write !== undefined) {
    await navigator.clipboard.write([new ClipboardItem({
      "text/plain": new Blob([content.text], { type: "text/plain" }),
      "text/html": new Blob([content.html], { type: "text/html" }),
    })]);
    return;
  }
  await navigator.clipboard.writeText(content.text);
};

export function PurchaseDraftEditor({ columns, draft, items, outputReady, templates, onChange, onNotice, onTemplatesChange }: Props) {
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const hasSelectedItems = items.some((item) => item.selected);
  const template = useMemo(() => createRuntimeTemplate(draft), [draft]);
  const preview = useMemo(() => createPurchaseDraftText(draft, items, template), [draft, items, template]);
  const update = (patch: Partial<PurchaseDraft>): void => onChange({ ...draft, ...patch });
  const moveField = (field: PurchaseDraftDetailFieldId, delta: number): void => {
    const next = [...draft.detailFieldOrder];
    const index = next.indexOf(field);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    const current = next[index];
    const replacement = next[target];
    if (current === undefined || replacement === undefined) return;
    next[index] = replacement;
    next[target] = current;
    update({ detailFieldOrder: next });
  };
  const applyTemplate = (templateId: string): void => {
    const next = templateId === defaultPurchaseDraftTemplate.id
      ? defaultPurchaseDraftTemplate
      : templates.find((entry) => entry.id === templateId);
    if (next === undefined) return;
    update({
      templateId: next.id,
      titlePattern: next.titlePattern,
      introPattern: next.introPattern,
      detailFieldOrder: next.detailFieldOrder,
      attachmentPhrase: next.attachmentPhrase,
      includeAttachment: next.includeAttachment,
    });
  };
  const saveTemplate = (): void => {
    const name = templateName.trim();
    if (name === "" || name.length > 40) {
      onNotice("템플릿 이름은 1~40자로 입력해 주세요.");
      return;
    }
    if (templates.length >= 10) {
      onNotice("품의문 템플릿은 최대 10개까지 저장할 수 있습니다.");
      return;
    }
    const saved: PurchaseDraftTemplate = {
      id: `draft-template-${Date.now()}`,
      name,
      titlePattern: draft.titlePattern,
      introPattern: draft.introPattern,
      detailFieldOrder: draft.detailFieldOrder,
      attachmentPhrase: draft.attachmentPhrase,
      includeAttachment: draft.includeAttachment,
    };
    onTemplatesChange([...templates, saved]);
    update({ templateId: saved.id });
    setTemplateName("");
    setIsSavingTemplate(false);
    onNotice("품의문 템플릿을 저장했습니다.");
  };
  const copyDraft = async (includeTable: boolean): Promise<void> => {
    if (!outputReady) {
      onNotice("입력 오류와 금액 불일치를 먼저 확인해 주세요.");
      return;
    }
    try {
      const content = createPurchaseDraftClipboard(draft, items, columns, template, includeTable);
      await writeClipboard(content, includeTable);
      onNotice(includeTable ? "품의문과 품목표를 복사했습니다." : "품의문을 복사했습니다.");
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;
      onNotice("품의문을 복사하지 못했습니다.");
    }
  };

  return (
    <div className="purchase-draft-editor">
      <section className="purchase-draft-form" aria-label="품의문 입력">
        <div className="purchase-draft-template-row">
          <label>문서 템플릿
            <select aria-label="품의문 템플릿" value={draft.templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <option value={defaultPurchaseDraftTemplate.id}>{defaultPurchaseDraftTemplate.name}</option>
              {templates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setIsSavingTemplate((current) => !current)}><Save size={14} /> 템플릿 저장</button>
        </div>
        {isSavingTemplate && <div className="purchase-draft-template-save"><input aria-label="품의문 템플릿 이름" maxLength={40} placeholder="예: 행정실 기본 양식" value={templateName} onChange={(event) => setTemplateName(event.target.value)} /><button type="button" onClick={saveTemplate}>저장</button></div>}
        {isSavingTemplate && <div className="purchase-draft-patterns"><label>제목 형식<input aria-label="품의문 제목 형식" maxLength={160} value={draft.titlePattern} onChange={(event) => update({ titlePattern: event.target.value })} /><small>{"{{title}}"} 위치에 현재 품의 제목이 들어갑니다.</small></label><label>도입 문구 형식<textarea aria-label="품의문 도입 문구 형식" rows={2} maxLength={160} value={draft.introPattern} onChange={(event) => update({ introPattern: event.target.value })} /><small>{"{{purpose}}"} 위치에 현재 구매 목적이 들어갑니다.</small></label></div>}
        {templates.length > 0 && <div className="purchase-draft-template-list" aria-label="저장된 품의문 템플릿">{templates.map((entry) => <span key={entry.id}><b>{entry.name}</b><button type="button" aria-label={`${entry.name} 템플릿 삭제`} onClick={() => { if (window.confirm(`'${entry.name}' 품의문 템플릿을 삭제할까요?`)) { onTemplatesChange(templates.filter((templateEntry) => templateEntry.id !== entry.id)); if (draft.templateId === entry.id) applyTemplate(defaultPurchaseDraftTemplate.id); } }}><Trash2 size={13} /></button></span>)}</div>}
        <label>품의 제목<input value={draft.title} onChange={(event) => update({ title: event.target.value })} /></label>
        <label>구매 목적<textarea rows={3} value={draft.purpose} onChange={(event) => update({ purpose: event.target.value })} /></label>
        <label>구매내용<input value={draft.purchaseSummary} onChange={(event) => update({ purchaseSummary: event.target.value })} /></label>
        <div className="purchase-draft-field-grid">
          <label>구매처<input value={draft.vendor} onChange={(event) => update({ vendor: event.target.value })} /></label>
          <label>예산항목<input value={draft.budgetItem} onChange={(event) => update({ budgetItem: event.target.value })} /></label>
        </div>
        {(draft.vendor === "여러 구매처" || draft.budgetItem === "여러 예산항목") && <p className="purchase-draft-check">서로 다른 값이 있어 직접 확인해 주세요.</p>}
        <label>추가 문구<textarea rows={2} value={draft.note} onChange={(event) => update({ note: event.target.value })} /></label>
        <fieldset className="purchase-draft-order"><legend>본문 항목 순서</legend>{draft.detailFieldOrder.map((field, index) => <div key={field}><span>{detailLabels[field]}</span><button type="button" aria-label={`${detailLabels[field]} 위로 이동`} disabled={index === 0} onClick={() => moveField(field, -1)}><ArrowUp size={13} /></button><button type="button" aria-label={`${detailLabels[field]} 아래로 이동`} disabled={index === draft.detailFieldOrder.length - 1} onClick={() => moveField(field, 1)}><ArrowDown size={13} /></button></div>)}</fieldset>
        <label>붙임 문구<input maxLength={120} value={draft.attachmentPhrase} onChange={(event) => update({ attachmentPhrase: event.target.value })} /></label>
        <label className="purchase-draft-attachment"><input type="checkbox" checked={draft.includeAttachment} onChange={(event) => update({ includeAttachment: event.target.checked })} /> 붙임 문구 포함</label>
      </section>
      <section className="purchase-draft-preview" aria-label="품의문 미리보기">
        <header><FileText size={17} /><strong>품의문 미리보기</strong></header>
        <pre aria-live="polite">{preview}</pre>
        <div><button type="button" disabled={!hasSelectedItems || !outputReady} onClick={() => void copyDraft(false)}><ClipboardCopy size={14} /> 품의문 복사</button><button type="button" disabled={!hasSelectedItems || !outputReady} onClick={() => void copyDraft(true)}><ClipboardCopy size={14} /> 품의문 + 품목표 복사</button></div>
      </section>
    </div>
  );
}
