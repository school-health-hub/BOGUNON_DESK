import { FileText, RotateCcw, ShieldAlert, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAiConnection } from "../../ai/AiConnectionContext";
import { generateOfficialDocumentDraft } from "../../official-document/documentGenerator";
import { copyOfficialDocumentText } from "../../official-document/clipboard";
import {
  importOfficialDocumentSource,
  pickAndExtractOfficialDocument,
} from "../../official-document/officialDocumentImportService";
import { useOfficialDocumentSession } from "../../official-document/OfficialDocumentSessionContext";
import {
  createOfficialDocumentAiService,
  createOfficialDocumentAiSendGate,
  getOfficialDocumentAiActionLabel,
  nextOfficialDocumentAiRequestId,
  type OfficialDocumentAiSendGate,
} from "../../official-document/officialDocumentAiService";
import {
  buildCreatePrompt,
  buildRevisionPrompt,
  buildSummaryPrompt,
} from "../../official-document/promptBuilder";
import {
  inspectOfficialDocumentPrivacy,
  officialDocumentPrivacyNotice,
} from "../../official-document/privacyGuard";
import { extractOfficialDocumentSummary } from "../../official-document/summaryExtractor";
import {
  createOfficialDocumentQuickAddDraft,
  type OfficialDocumentQuickAddDraft,
} from "../../official-document/summaryToQuickAddDraft";
import type { OfficialDocumentMode } from "../../official-document/types";
import { getDesktopErrorMessage } from "../../desktop/actions";
import { OfficialDocumentCreateForm } from "./OfficialDocumentCreateForm";
import { OfficialDocumentOutput } from "./OfficialDocumentOutput";
import { OfficialDocumentSourceField } from "./OfficialDocumentSourceField";

const modeLabels: Readonly<Record<OfficialDocumentMode, string>> = {
  create: "새 공문 작성",
  revision: "받은 공문 수정",
  summary: "공문 핵심정리",
};

type OfficialDocumentPanelProps = {
  readonly onClose: () => void;
  readonly onNotice: (message: string) => void;
  readonly onOpenAiSettings: () => void;
  readonly onSendSummaryToQuickAdd: (draft: OfficialDocumentQuickAddDraft) => void;
};

type PendingAiConfirmation = {
  readonly gate: OfficialDocumentAiSendGate;
  readonly mode: OfficialDocumentMode;
  readonly prompt: string;
  readonly providerLabel: string;
};

export function OfficialDocumentAiConfirmation({
  confirmation,
  onCancel,
  onConfirm,
}: {
  readonly confirmation: Pick<PendingAiConfirmation, "prompt" | "providerLabel">;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="official-document-ai-confirm-backdrop">
      <section className="official-document-ai-confirm" role="dialog" aria-modal="true" aria-labelledby="official-document-ai-confirm-title">
        <header>
          <div>
            <h3 id="official-document-ai-confirm-title">AI 전송 내용 확인</h3>
            <p>{confirmation.providerLabel} 서비스로 다음 내용이 전송됩니다.</p>
          </div>
          <button type="button" aria-label="AI 전송 취소" onClick={onCancel}><X size={17} /></button>
        </header>
        <p className="official-document-ai-confirm__warning">자동 검사는 보조 기능이며 모든 개인정보를 탐지하지 못할 수 있습니다. 내용을 직접 확인한 뒤 전송해 주세요.</p>
        <pre tabIndex={0} aria-label="AI 서비스로 전송될 내용">{confirmation.prompt}</pre>
        <footer>
          <button type="button" onClick={onCancel}>취소</button>
          <button className="is-primary" type="button" onClick={onConfirm}>확인 후 전송</button>
        </footer>
      </section>
    </div>
  );
}

export function OfficialDocumentPanel({ onClose, onNotice, onOpenAiSettings, onSendSummaryToQuickAdd }: OfficialDocumentPanelProps) {
  const ai = useAiConnection();
  const { state, dispatch } = useOfficialDocumentSession();
  const [importingMode, setImportingMode] = useState<"revision" | "summary" | null>(null);
  const [pendingAiConfirmation, setPendingAiConfirmation] = useState<PendingAiConfirmation | null>(null);
  const output = state.outputs[state.mode];
  const aiService = useMemo(() => createOfficialDocumentAiService({
    getConnection: () => ({ status: ai.state.status, provider: ai.state.provider }),
    generateText: ai.generateText,
  }), [ai.generateText, ai.state.provider, ai.state.status]);

  const buildPrompt = (): string => {
    const prompt = state.mode === "create"
      ? buildCreatePrompt(state.createInput)
      : state.mode === "revision"
        ? buildRevisionPrompt(state.revisionInput)
        : buildSummaryPrompt(state.summaryOriginal);
    dispatch({ type: "setPrompt", mode: state.mode, prompt });
    return prompt;
  };

  const privateSource = state.mode === "create"
    ? Object.values(state.createInput).join("\n")
    : state.mode === "revision"
      ? `${state.revisionInput.original}\n${state.revisionInput.request}`
      : state.summaryOriginal;

  const prepareConnectedAi = (): void => {
    const privacy = inspectOfficialDocumentPrivacy(privateSource);
    if (!privacy.isSafe) {
      dispatch({
        type: "setAiStatus",
        status: "error",
        error: `민감한 개인정보 가능성이 있습니다: ${privacy.findings.join(", ")}. 내용을 제거한 뒤 다시 시도해 주세요.`,
      });
      return;
    }
    if (ai.state.provider === null) return;
    const prompt = buildPrompt();
    setPendingAiConfirmation({
      gate: createOfficialDocumentAiSendGate(prompt, aiService.generate),
      mode: state.mode,
      prompt,
      providerLabel: ai.state.provider === "openai" ? "OpenAI" : "Gemini",
    });
  };

  const confirmConnectedAi = async (): Promise<void> => {
    const confirmation = pendingAiConfirmation;
    if (confirmation === null) return;
    setPendingAiConfirmation(null);
    const requestId = nextOfficialDocumentAiRequestId();
    dispatch({ type: "beginAiRequest", requestId });
    try {
      const response = await confirmation.gate.confirm();
      if (response === null) return;
      dispatch({ type: "resolveAiRequest", requestId, mode: confirmation.mode, response });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "AI 서비스에 연결하지 못했습니다.";
      dispatch({ type: "failAiRequest", requestId, error: message });
    }
  };

  const cancelConnectedAi = (): void => {
    pendingAiConfirmation?.gate.cancel();
    setPendingAiConfirmation(null);
  };

  const copy = async (label: string, value: string): Promise<void> => {
    try {
      onNotice(await copyOfficialDocumentText(navigator.clipboard.writeText.bind(navigator.clipboard), label, value));
    } catch {
      onNotice(`${label}을(를) 복사하지 못했습니다.`);
    }
  };

  const buildLocalSummary = (): void => {
    if (state.summaryOriginal.trim() === "") {
      onNotice("정리할 공문 원문을 입력하거나 파일을 가져와 주세요.");
      return;
    }
    dispatch({
      type: "setSummaryLocalResult",
      result: extractOfficialDocumentSummary(state.summaryOriginal),
    });
  };

  const importSource = async (mode: "revision" | "summary"): Promise<void> => {
    const currentText = mode === "revision" ? state.revisionInput.original : state.summaryOriginal;
    setImportingMode(mode);
    try {
      const result = await importOfficialDocumentSource({
        currentText,
        confirmReplace: window.confirm.bind(window),
        pickDocument: pickAndExtractOfficialDocument,
      });
      if (result === null) return;
      dispatch(mode === "revision"
        ? { type: "importRevisionSource", original: result.text, sourceName: result.sourceName }
        : { type: "importSummarySource", original: result.text, sourceName: result.sourceName });
      onNotice(`${result.sourceName} 내용을 가져왔습니다.`);
    } catch (error: unknown) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setImportingMode(null);
    }
  };

  return (
    <div className="desktop-panel-backdrop official-document-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="official-document-panel" role="dialog" aria-modal="true" aria-labelledby="official-document-title">
        <header className="official-document-panel__header">
          <span><FileText size={20} /></span>
          <div><h2 id="official-document-title">공문 작업실</h2><p>공문 초안 작성부터 수정·핵심정리까지</p></div>
          <button type="button" aria-label="공문 작업실 닫기" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="official-document-panel__tabs" role="tablist" aria-label="공문 작업 종류">
          {(Object.keys(modeLabels) as OfficialDocumentMode[]).map((mode) => (
            <button type="button" role="tab" aria-selected={state.mode === mode} className={state.mode === mode ? "is-active" : ""} key={mode} onClick={() => dispatch({ type: "selectMode", mode })}>{modeLabels[mode]}</button>
          ))}
          <button className="official-document-panel__reset" type="button" onClick={() => dispatch({ type: "reset" })}><RotateCcw size={14} /> 새 작업</button>
        </div>
        <div className="official-document-panel__body">
          <div className="official-document-editor">
            {state.mode === "create" && <OfficialDocumentCreateForm input={state.createInput} onFieldChange={(field, value) => dispatch({ type: "updateCreate", field, value })} onPurposeChange={(purpose) => dispatch({ type: "updateCreatePurpose", purpose })} onWorkAreaChange={(workArea) => dispatch({ type: "updateCreateWorkArea", workArea })} />}
            {state.mode === "revision" && <div className="official-document-text-inputs"><OfficialDocumentSourceField id="official-document-revision-original" isImporting={importingMode === "revision"} rows={12} sourceName={state.revisionSourceName} value={state.revisionInput.original} placeholder="수정할 공문 원문을 붙여넣으세요." onImport={() => void importSource("revision")} onChange={(event) => dispatch({ type: "updateRevision", value: { ...state.revisionInput, original: event.currentTarget.value } })} /><label><span>수정 요청</span><textarea rows={7} value={state.revisionInput.request} placeholder="관내 특수학교만 대상으로 변경&#10;제출기한은 9월 23일&#10;제출방법은 공문 제출" onChange={(event) => dispatch({ type: "updateRevision", value: { ...state.revisionInput, request: event.currentTarget.value } })} /></label></div>}
            {state.mode === "summary" && <div className="official-document-text-inputs"><OfficialDocumentSourceField id="official-document-summary-original" isImporting={importingMode === "summary"} rows={20} sourceName={state.summarySourceName} value={state.summaryOriginal} placeholder="핵심을 정리할 공문 원문을 붙여넣으세요." onImport={() => void importSource("summary")} onChange={(event) => dispatch({ type: "updateSummary", original: event.currentTarget.value })} /></div>}
            <section className="official-document-action-area" aria-label="공문 작업 실행">
              <div className="official-document-actions">
                {state.mode === "create" && <button className="is-primary" type="button" onClick={() => dispatch({ type: "setDraft", draft: generateOfficialDocumentDraft(state.createInput) })}>기본 초안 만들기</button>}
                {state.mode === "summary" && <button className="is-primary" type="button" onClick={buildLocalSummary}>기본 핵심정리</button>}
                <button type="button" onClick={buildPrompt}><Sparkles size={15} /> AI 프롬프트 만들기</button>
                {ai.state.status === "connected" && ai.state.provider !== null && <button type="button" disabled={state.aiStatus === "generating" || pendingAiConfirmation !== null} onClick={prepareConnectedAi}>{state.aiStatus === "generating" ? "작성 중…" : getOfficialDocumentAiActionLabel(ai.state.provider, state.mode)}</button>}
              </div>
              <p className="official-document-prompt-help">공문 내용과 요청사항을 정리해 ChatGPT, Gemini 등에서 사용할 수 있는 프롬프트를 만듭니다.</p>
              <aside className="official-document-privacy"><ShieldAlert size={16} /><span>{officialDocumentPrivacyNotice}</span></aside>
              {ai.state.status === "connected" && ai.state.provider !== null ? <p className="official-document-ai-state">✓ {ai.state.provider === "openai" ? "OpenAI" : "Gemini"} 연결됨</p> : <div className="official-document-ai-state"><span>AI 서비스가 연결되지 않았습니다.</span><button type="button" onClick={onOpenAiSettings}>AI 연결 설정</button></div>}
              {state.aiError !== null && <p className="official-document-error" role="alert">{state.aiError}</p>}
            </section>
          </div>
          <OfficialDocumentOutput aiResponse={output.aiResponse} draft={state.mode === "create" ? state.draft : null} localSummary={state.mode === "summary" ? state.summaryLocalResult : null} mode={state.mode} prompt={output.prompt} onCopy={(label, value) => void copy(label, value)} onSendSummaryToQuickAdd={() => {
            if (state.summaryLocalResult !== null) {
              onSendSummaryToQuickAdd(createOfficialDocumentQuickAddDraft(state.summaryLocalResult));
            }
          }} />
        </div>
        {pendingAiConfirmation !== null && (
          <OfficialDocumentAiConfirmation
            confirmation={pendingAiConfirmation}
            onCancel={cancelConnectedAi}
            onConfirm={() => void confirmConnectedAi()}
          />
        )}
        <footer>입력과 결과는 현재 앱을 실행하는 동안에만 메모리에 유지되며 자동 저장되지 않습니다.</footer>
      </section>
    </div>
  );
}
