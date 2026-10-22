import { ClipboardCopy, FileText } from "lucide-react";
import { composeOfficialDocumentDraft } from "../../official-document/documentGenerator";
import type { OfficialDocumentLocalSummary } from "../../official-document/summaryExtractor";
import type { OfficialDocumentAiStatus, OfficialDocumentDraft, OfficialDocumentMode } from "../../official-document/types";
import { OfficialDocumentLocalSummaryView } from "./OfficialDocumentLocalSummary";

type OfficialDocumentOutputProps = {
  readonly aiResponse: string;
  readonly aiStatus: OfficialDocumentAiStatus;
  readonly draft: OfficialDocumentDraft | null;
  readonly mode: OfficialDocumentMode;
  readonly localSummary: OfficialDocumentLocalSummary | null;
  readonly prompt: string;
  readonly onCopy: (label: string, value: string) => void;
  readonly onSendSummaryToQuickAdd: () => void;
};

const emptyStateCopy: Readonly<Record<OfficialDocumentMode, {
  readonly title: string;
  readonly description: string;
}>> = {
  create: {
    title: "아직 작성된 초안이 없습니다.",
    description: "왼쪽 정보를 입력한 뒤 기본 초안을 만들어 보세요.",
  },
  revision: {
    title: "수정 결과가 여기에 표시됩니다.",
    description: "공문 원문과 수정 요청을 입력한 뒤 작업을 시작해 보세요.",
  },
  summary: {
    title: "정리 결과가 여기에 표시됩니다.",
    description: "공문 원문을 입력한 뒤 핵심정리를 시작해 보세요.",
  },
};

function CopyButton({ label, value, onCopy }: {
  readonly label: string;
  readonly value: string;
  readonly onCopy: (label: string, value: string) => void;
}) {
  return (
    <button type="button" disabled={value === ""} onClick={() => onCopy(label, value)}>
      <ClipboardCopy size={14} /> {label} 복사
    </button>
  );
}

export function OfficialDocumentOutput({ aiResponse, aiStatus, draft, mode, localSummary, prompt, onCopy, onSendSummaryToQuickAdd }: OfficialDocumentOutputProps) {
  if (draft === null && localSummary === null && prompt === "" && aiResponse === "") {
    const copy = emptyStateCopy[mode];
    return (
      <div className="official-document-output is-empty">
        <section className="official-document-preview" aria-label="문서 미리보기">
          <header className="official-document-preview__toolbar"><strong>문서 미리보기</strong><span>로컬 작업 결과</span></header>
          <div className="official-document-paper is-empty" aria-live="polite">
            <div className="official-document-empty">
              <span aria-hidden="true"><FileText size={22} /></span>
              <strong>{copy.title}</strong>
              <p>{copy.description}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="official-document-output">
      {localSummary !== null && <OfficialDocumentLocalSummaryView summary={localSummary} onCopy={onCopy} onSendToQuickAdd={onSendSummaryToQuickAdd} />}
      {draft !== null && (
        <section className="official-document-preview" aria-label="기본 초안 문서 미리보기">
          <header className="official-document-preview__toolbar">
            <div><strong>기본 초안</strong><span>읽기 전용 미리보기</span></div>
            <div><CopyButton label="제목" value={draft.title} onCopy={onCopy} /><CopyButton label="본문" value={draft.body} onCopy={onCopy} /><CopyButton label="전체" value={composeOfficialDocumentDraft(draft)} onCopy={onCopy} /></div>
          </header>
          <article className="official-document-paper">
            <header><span>공문 제목</span><h3>{draft.title}</h3></header>
            <section aria-label="공문 본문"><pre>{draft.body}</pre></section>
            <section className="official-document-paper__attachments" aria-label="붙임"><pre>{draft.attachments}</pre></section>
          </article>
          <div className="official-document-appendix" aria-label="공문 부록">
            <section><strong>교직원 메신저</strong><pre>{draft.messenger}</pre></section>
            <section><strong>기안 전 체크리스트</strong><pre>{draft.checklist}</pre></section>
            {draft.tableText ? <section className="is-wide"><div><strong>표 복사용 본문</strong><CopyButton label="표" value={draft.tableText} onCopy={onCopy} /></div><pre>{draft.tableText}</pre>{draft.tableGuide ? <p className="official-document-result__notice">{draft.tableGuide}</p> : null}</section> : null}
          </div>
        </section>
      )}
      {prompt !== "" && (
        <section className="official-document-result official-document-result--supporting">
          <header><strong>AI 프롬프트 미리보기</strong><CopyButton label="프롬프트" value={prompt} onCopy={onCopy} /></header>
          <pre>{prompt}</pre>
        </section>
      )}
      {aiResponse !== "" && (
        <section className="official-document-result official-document-result--supporting is-ai">
          <header><strong>{aiStatus === "generating" ? "이전 AI 결과" : aiStatus === "error" ? "이전 AI 결과 유지됨" : "연결한 AI 작성 결과"}</strong><CopyButton label="AI 결과" value={aiResponse} onCopy={onCopy} /></header>
          {aiStatus === "generating" && <p className="official-document-result__notice">새 결과를 작성하는 동안 이전 정상 결과를 표시합니다.</p>}
          <pre>{aiResponse}</pre>
        </section>
      )}
    </div>
  );
}
