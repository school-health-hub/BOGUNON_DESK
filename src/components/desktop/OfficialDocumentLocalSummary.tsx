import { ClipboardCopy, Send } from "lucide-react";
import {
  formatOfficialDocumentSummary,
  type OfficialDocumentLocalSummary,
  type OfficialDocumentSummaryField,
} from "../../official-document/summaryExtractor";

function SummaryField({ field }: { readonly field: OfficialDocumentSummaryField }) {
  if (field.value === null) {
    return <p className="official-document-summary__missing">확인 필요</p>;
  }
  return (
    <>
      <p className="official-document-summary__value">{field.value}</p>
      {field.evidence !== null && <p className="official-document-summary__evidence">근거: “{field.evidence}”</p>}
    </>
  );
}

function SummaryList({ fields }: { readonly fields: readonly OfficialDocumentSummaryField[] }) {
  if (fields.length === 0) {
    return <p className="official-document-summary__missing">확인 필요</p>;
  }
  return (
    <ul className="official-document-summary__list">
      {fields.map((field, index) => (
        <li key={`${field.value ?? "missing"}-${index}`}>
          <SummaryField field={field} />
        </li>
      ))}
    </ul>
  );
}

export function OfficialDocumentLocalSummaryView({ summary, onCopy, onSendToQuickAdd }: {
  readonly summary: OfficialDocumentLocalSummary;
  readonly onCopy: (label: string, value: string) => void;
  readonly onSendToQuickAdd: () => void;
}) {
  return (
    <section className="official-document-result official-document-summary">
      <header>
        <strong>기본 핵심정리</strong>
        <button type="button" onClick={() => onCopy("전체", formatOfficialDocumentSummary(summary))}>
          <ClipboardCopy size={14} /> 전체 복사
        </button>
      </header>
      <p className="official-document-summary__notice">원문에서 명확히 확인된 항목만 정리했습니다.</p>
      <article><strong>내가 해야 할 일</strong><SummaryList fields={summary.actions} /></article>
      <article><strong>대상</strong><SummaryField field={summary.target} /></article>
      <article><strong>제출기한</strong><SummaryField field={summary.deadline} /></article>
      <article><strong>제출방법</strong><SummaryField field={summary.submissionMethod} /></article>
      <article><strong>제출자료</strong><SummaryList fields={summary.materials} /></article>
      <article><strong>붙임</strong><SummaryList fields={summary.attachments} /></article>
      <article><strong>담당자 확인사항</strong><SummaryField field={summary.contact} /></article>
      <div className="official-document-summary__handoff">
        <button className="is-primary" type="button" onClick={onSendToQuickAdd}>
          <Send size={14} /> BOGUNON 업무로 보내기
        </button>
      </div>
    </section>
  );
}
