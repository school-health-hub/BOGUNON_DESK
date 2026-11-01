import { editOfficialDocumentBody } from "../../official-document/officialDocumentDraftEditing";
import type { OfficialDocumentDraft } from "../../official-document/types";

type Props = {
  readonly draft: OfficialDocumentDraft;
  readonly disabled: boolean;
  readonly onChange: (draft: OfficialDocumentDraft) => void;
};

export function OfficialDocumentDraftEditor({ draft, disabled, onChange }: Props) {
  return (
    <details className="official-document-result">
      <summary>제목·본문 수정</summary>
      <div className="official-document-form-grid">
        <label className="is-wide">
          <span>공문 제목 편집</span>
          <input value={draft.title} disabled={disabled} onChange={(event) => onChange({ ...draft, title: event.currentTarget.value })} />
        </label>
        <label className="is-wide">
          <span>공문 본문 편집</span>
          <textarea rows={12} value={draft.body} disabled={disabled} onChange={(event) => onChange(editOfficialDocumentBody(draft, event.currentTarget.value))} />
        </label>
      </div>
      <p className="official-document-result__notice">문단·번호·줄바꿈은 입력한 그대로 저장합니다. 붙임을 포함한 본문 마지막에 끝.을 한 번만 남겨 주세요.</p>
    </details>
  );
}
