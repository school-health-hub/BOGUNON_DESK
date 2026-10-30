import { BookOpenCheck, CircleCheck, FileText, RotateCcw, ShieldAlert, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAiConnection } from "../../ai/AiConnectionContext";
import { useChatGptConnection } from "../../chatgpt/ChatGptConnectionContext";
import { generateOfficialDocumentDraft } from "../../official-document/documentGenerator";
import { copyOfficialDocumentText } from "../../official-document/clipboard";
import { saveOfficialDocumentOdt } from "../../official-document/officialDocumentExportService";
import {
  importOfficialDocumentSource,
  pickAndExtractOfficialDocument,
} from "../../official-document/officialDocumentImportService";
import { useOfficialDocumentSession } from "../../official-document/OfficialDocumentSessionContext";
import {
  createOfficialDocumentAiService,
  getOfficialDocumentAiActionLabel,
  getOfficialDocumentChatGptPlanActionLabel,
  nextOfficialDocumentAiRequestId,
  prepareOfficialDocumentAiSend,
  selectOfficialDocumentAiGenerator,
} from "../../official-document/officialDocumentAiService";
import {
  buildCreatePrompt,
  buildRevisionPrompt,
  buildSummaryPrompt,
} from "../../official-document/promptBuilder";
import { officialDocumentPrivacyNotice } from "../../official-document/privacyGuard";
import { applyOfficialDocumentReference, createReferenceDraftSeed } from "../../official-document/referenceMapper";
import { createNotConnectedOfficialDocumentReferenceRepository } from "../../official-document/referenceRepository";
import type { OfficialDocumentReference, OfficialDocumentReferenceRepository } from "../../official-document/referenceTypes";
import { extractOfficialDocumentSummary } from "../../official-document/summaryExtractor";
import {
  createOfficialDocumentQuickAddDraft,
  type OfficialDocumentQuickAddDraft,
} from "../../official-document/summaryToQuickAddDraft";
import type { OfficialDocumentMode } from "../../official-document/types";
import { getDesktopErrorMessage } from "../../desktop/actions";
import {
  OfficialDocumentAiConfirmation,
  type OfficialDocumentAiConfirmationData,
  type OfficialDocumentAiConfirmationResult,
} from "./OfficialDocumentAiConfirmation";
import { OfficialDocumentCreateForm } from "./OfficialDocumentCreateForm";
import { OfficialDocumentOutput } from "./OfficialDocumentOutput";
import { OfficialDocumentSourceField } from "./OfficialDocumentSourceField";
import { OfficialDocumentReferencePicker } from "./OfficialDocumentReferencePicker";
import { OfficialDocumentReferenceConfirmation } from "./OfficialDocumentReferenceConfirmation";
import { OfficialDocumentPackageManager } from "./OfficialDocumentPackageManager";

const modeLabels: Readonly<Record<OfficialDocumentMode, string>> = {
  create: "새 공문 작성",
  revision: "받은 공문 수정",
  summary: "공문 핵심정리",
};

const privacyNoticeParts = officialDocumentPrivacyNotice.split(/(탐지하지 못할 수 있습니다\.|AI 서비스로)/);

type OfficialDocumentPanelProps = {
  readonly onClose: () => void;
  readonly onNotice: (message: string) => void;
  readonly onOpenAiSettings: () => void;
  readonly onSendSummaryToQuickAdd: (draft: OfficialDocumentQuickAddDraft) => void;
  readonly referenceRepository?: OfficialDocumentReferenceRepository;
};

type PendingAiConfirmation = OfficialDocumentAiConfirmationData & {
  readonly generate: (prompt: string) => Promise<string>;
  readonly mode: OfficialDocumentMode;
};

type PendingReferenceApplication = {
  readonly application: ReturnType<typeof applyOfficialDocumentReference>;
  readonly reference: OfficialDocumentReference;
};

type ReferenceWorkspaceView = "browse" | "manage" | null;

export { OfficialDocumentAiConfirmation } from "./OfficialDocumentAiConfirmation";

const defaultReferenceRepository = createNotConnectedOfficialDocumentReferenceRepository();

export function OfficialDocumentPanel({ onClose, onNotice, onOpenAiSettings, onSendSummaryToQuickAdd, referenceRepository }: OfficialDocumentPanelProps) {
  const ai = useAiConnection();
  const chatGpt = useChatGptConnection();
  const { state, dispatch } = useOfficialDocumentSession();
  const [importingMode, setImportingMode] = useState<"revision" | "summary" | null>(null);
  const [pendingAiConfirmation, setPendingAiConfirmation] = useState<PendingAiConfirmation | null>(null);
  const [pendingReferenceApplication, setPendingReferenceApplication] = useState<PendingReferenceApplication | null>(null);
  const [packageRepository, setPackageRepository] = useState<OfficialDocumentReferenceRepository>(defaultReferenceRepository);
  const [packageBusy, setPackageBusy] = useState(false);
  const [isExportingOdt, setIsExportingOdt] = useState(false);
  const [referenceWorkspaceView, setReferenceWorkspaceView] = useState<ReferenceWorkspaceView>(null);
  const output = state.outputs[state.mode];
  const apiConnectionAvailable = ai.state.status === "connected" && ai.state.provider !== null;
  const chatGptPlanUsageAvailable = chatGpt.state.status === "connected" && chatGpt.state.planUsageEnabled;
  const selectedChatGptModel = chatGpt.selectedModel === null
    ? null
    : chatGpt.models.find((model) => model.slug === chatGpt.selectedModel) ?? null;
  const chatGptPlanAvailable = chatGptPlanUsageAvailable
    && !chatGpt.modelsLoading
    && chatGpt.modelsError === null
    && selectedChatGptModel !== null;
  const selectedChatGptModelLabel = selectedChatGptModel?.displayName ?? chatGpt.selectedModel;
  const connectionLabel = chatGptPlanAvailable && selectedChatGptModelLabel !== null
    ? `ChatGPT · ${selectedChatGptModelLabel}`
    : apiConnectionAvailable && ai.state.provider !== null
      ? ai.state.provider === "openai" ? "OpenAI 연결됨" : "Gemini 연결됨"
      : "AI 미연결";
  const referenceSummary = state.appliedReference !== null
    ? `초안 적용됨 · ${state.appliedReference.title}`
    : state.selectedReference !== null
      ? `선택됨 · ${state.selectedReference.title}`
      : "선택한 자료 없음";
  const apiAiService = useMemo(() => createOfficialDocumentAiService({
    isAvailable: () => ai.state.status === "connected" && ai.state.provider !== null,
    generateText: ai.generateText,
  }), [ai.generateText, ai.state.provider, ai.state.status]);
  const chatGptPlanAiService = useMemo(() => createOfficialDocumentAiService({
    isAvailable: () => chatGpt.state.status === "connected"
      && chatGpt.state.planUsageEnabled
      && !chatGpt.modelsLoading
      && chatGpt.modelsError === null
      && selectedChatGptModel !== null,
    generateText: chatGpt.generateText,
  }), [chatGpt.generateText, chatGpt.modelsError, chatGpt.modelsLoading, selectedChatGptModel, chatGpt.state.planUsageEnabled, chatGpt.state.status]);

  const buildCurrentPrompt = (): string => (
    state.mode === "create"
      ? buildCreatePrompt(state.createInput, state.selectedReference)
      : state.mode === "revision"
        ? buildRevisionPrompt(state.revisionInput)
        : buildSummaryPrompt(state.summaryOriginal)
  );

  const buildPrompt = (): string => {
    const prompt = buildCurrentPrompt();
    dispatch({ type: "setPrompt", mode: state.mode, prompt });
    return prompt;
  };

  const prepareConnectedAi = (
    providerLabel: string,
    generate: (prompt: string) => Promise<string>,
  ): void => {
    setPendingAiConfirmation({
      generate,
      mode: state.mode,
      outboundText: output.reviewedOutbound ?? buildCurrentPrompt(),
      providerLabel,
    });
  };

  const confirmConnectedAi = async (result: OfficialDocumentAiConfirmationResult): Promise<void> => {
    const confirmation = pendingAiConfirmation;
    if (confirmation === null) return;
    const prepared = prepareOfficialDocumentAiSend({
      outboundText: result.outboundText,
      generate: confirmation.generate,
    });
    if (prepared.status === "blocked") {
      dispatch({ type: "setAiStatus", status: "error", error: prepared.error });
      return;
    }
    setPendingAiConfirmation(null);
    const requestId = nextOfficialDocumentAiRequestId();
    dispatch({ type: "storeReviewedOutbound", mode: confirmation.mode, outboundText: prepared.prompt });
    dispatch({ type: "beginAiRequest", requestId });
    try {
      const response = await prepared.gate.confirm();
      if (response === null) return;
      dispatch({ type: "resolveAiRequest", requestId, mode: confirmation.mode, response });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "AI 서비스에 연결하지 못했습니다.";
      dispatch({ type: "failAiRequest", requestId, error: message });
    }
  };

  const cancelConnectedAi = (): void => {
    setPendingAiConfirmation(null);
  };

  const cancelActiveAiRequest = (): void => {
    if (state.activeAiRequestId === null) return;
    dispatch({ type: "cancelAiRequest", requestId: state.activeAiRequestId });
  };

  const routeActionLabel = (routePrefix: string, defaultLabel: string): string => {
    if (output.aiResponse.trim() !== "") return `${routePrefix} 다시 생성`;
    if (state.aiStatus === "error") return `${routePrefix} 다시 시도`;
    return defaultLabel;
  };

  const copy = async (label: string, value: string): Promise<void> => {
    try {
      onNotice(await copyOfficialDocumentText(navigator.clipboard.writeText.bind(navigator.clipboard), label, value));
    } catch {
      onNotice(`${label}을(를) 복사하지 못했습니다.`);
    }
  };

  const exportOdt = async (): Promise<void> => {
    if (state.draft === null || isExportingOdt) return;
    setIsExportingOdt(true);
    try {
      const result = await saveOfficialDocumentOdt(state.draft);
      if (result.status === "saved") onNotice(`${result.fileName} 파일을 저장했습니다.`);
    } catch (error: unknown) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsExportingOdt(false);
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

  const applyReference = (reference: OfficialDocumentReference): void => {
    setPendingReferenceApplication({
      application: applyOfficialDocumentReference(state.createInput, reference, state.touchedCreateFields),
      reference,
    });
  };

  useEffect(() => {
    setPendingAiConfirmation(null);
  }, [ai.state.provider, ai.state.status, chatGpt.modelsError, chatGpt.modelsLoading, chatGpt.selectedModel, chatGpt.state.planUsageEnabled, chatGpt.state.status]);

  const confirmReferenceApplication = (): void => {
    if (pendingReferenceApplication === null) return;
    const { application, reference } = pendingReferenceApplication;
    dispatch({ type: "applyReference", reference, input: application.input });
    setPendingReferenceApplication(null);
    onNotice(`${reference.title} 참고자료를 초안에 적용했습니다.`);
  };

  return (
    <div className="desktop-panel-backdrop official-document-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="official-document-panel" role="dialog" aria-modal="true" aria-labelledby="official-document-title">
        <header className="official-document-panel__header">
          <span><FileText size={20} /></span>
          <div className="official-document-panel__heading"><h2 id="official-document-title">공문 작업실</h2><p>작성부터 수정·핵심정리까지 한 화면에서 처리합니다.</p></div>
          <div className="official-document-panel__header-actions">
            <span className={`official-document-connection${apiConnectionAvailable || chatGptPlanAvailable ? " is-connected" : ""}`}>{connectionLabel}</span>
            <button className="official-document-panel__reset" type="button" onClick={() => { dispatch({ type: "reset" }); setReferenceWorkspaceView(null); }}><RotateCcw size={14} /> 새 작업</button>
            <button className="official-document-panel__close" type="button" aria-label="공문 작업실 닫기" onClick={onClose}><X size={18} /></button>
          </div>
        </header>
        <div className="official-document-panel__tabs" role="tablist" aria-label="공문 작업 종류">
          {(Object.keys(modeLabels) as OfficialDocumentMode[]).map((mode) => (
            <button type="button" role="tab" aria-selected={state.mode === mode} className={state.mode === mode ? "is-active" : ""} key={mode} onClick={() => dispatch({ type: "selectMode", mode })}>{modeLabels[mode]}</button>
          ))}
        </div>
        <div className="official-document-panel__body">
          <div className="official-document-editor">
            <div className="official-document-editor__content">
              {state.mode === "create" && <>
              <OfficialDocumentCreateForm input={state.createInput} onFieldChange={(field, value) => dispatch({ type: "updateCreate", field, value })} onPurposeChange={(purpose) => dispatch({ type: "updateCreatePurpose", purpose })} onWorkAreaChange={(workArea) => dispatch({ type: "updateCreateWorkArea", workArea })} />
              <section className="official-document-reference-tools" aria-labelledby="official-document-reference-tools-title">
                <header>
                  <div><BookOpenCheck size={17} /><span><strong id="official-document-reference-tools-title">참고자료</strong><small>{referenceSummary}</small></span></div>
                  <div className="official-document-reference-tools__actions">
                    <button type="button" aria-expanded={referenceWorkspaceView === "browse"} onClick={() => setReferenceWorkspaceView((current) => current === "browse" ? null : "browse")}>찾기</button>
                    {referenceRepository === undefined && <button type="button" aria-expanded={referenceWorkspaceView === "manage"} onClick={() => setReferenceWorkspaceView((current) => current === "manage" ? null : "manage")}>관리</button>}
                  </div>
                </header>
                <div hidden={referenceWorkspaceView !== "browse"}>
                  <OfficialDocumentReferencePicker disabled={referenceRepository === undefined && packageBusy} repository={referenceRepository ?? packageRepository} selected={state.selectedReference} applied={state.appliedReference} onSelect={(reference) => dispatch({ type: "selectReference", reference })} onApply={applyReference} />
                </div>
                {referenceRepository === undefined && <div hidden={referenceWorkspaceView !== "manage"}><OfficialDocumentPackageManager onRepositoryChange={setPackageRepository} onBusyChange={setPackageBusy} /></div>}
              </section>
              </>}
              {state.mode === "revision" && <div className="official-document-text-inputs"><OfficialDocumentSourceField id="official-document-revision-original" isImporting={importingMode === "revision"} rows={12} sourceName={state.revisionSourceName} value={state.revisionInput.original} placeholder="수정할 공문 원문을 붙여넣으세요." onImport={() => void importSource("revision")} onChange={(event) => dispatch({ type: "updateRevision", value: { ...state.revisionInput, original: event.currentTarget.value } })} /><label><span>수정 요청</span><textarea rows={7} value={state.revisionInput.request} placeholder="관내 특수학교만 대상으로 변경&#10;제출기한은 9월 23일&#10;제출방법은 공문 제출" onChange={(event) => dispatch({ type: "updateRevision", value: { ...state.revisionInput, request: event.currentTarget.value } })} /></label></div>}
              {state.mode === "summary" && <div className="official-document-text-inputs"><OfficialDocumentSourceField id="official-document-summary-original" isImporting={importingMode === "summary"} rows={20} sourceName={state.summarySourceName} value={state.summaryOriginal} placeholder="핵심을 정리할 공문 원문을 붙여넣으세요." onImport={() => void importSource("summary")} onChange={(event) => dispatch({ type: "updateSummary", original: event.currentTarget.value })} /></div>}
            </div>
            <section className="official-document-action-area" aria-label="공문 작업 실행">
              {(state.mode === "create" || state.mode === "summary") && <div className="official-document-action-group is-local">
                <span>로컬 작업</span>
                <div className="official-document-actions">
                  {state.mode === "create" && <button className="is-primary" type="button" onClick={() => dispatch({ type: "setDraft", draft: generateOfficialDocumentDraft(state.createInput, state.appliedReference === null ? null : createReferenceDraftSeed(state.appliedReference)) })}>기본 초안 만들기</button>}
                  {state.mode === "summary" && <button className="is-primary" type="button" onClick={buildLocalSummary}>기본 핵심정리</button>}
                </div>
              </div>}
              <div className="official-document-action-group">
                <span>AI 보조 도구</span>
                <div className="official-document-actions">
                <button type="button" disabled={state.aiStatus === "generating" || pendingAiConfirmation !== null} onClick={buildPrompt}><Sparkles size={15} /> AI 프롬프트 만들기</button>
                {state.aiStatus === "generating" ? (
                  <button type="button" onClick={cancelActiveAiRequest}>작성 중단</button>
                ) : (
                  <>
                    {chatGptPlanAvailable && selectedChatGptModelLabel !== null && <button type="button" disabled={pendingAiConfirmation !== null} onClick={() => prepareConnectedAi(`ChatGPT 요금제 · ${selectedChatGptModelLabel}`, selectOfficialDocumentAiGenerator("chatGptPlan", { apiConnection: apiAiService.generate, chatGptPlan: chatGptPlanAiService.generate }))}>{routeActionLabel("ChatGPT 요금제로", getOfficialDocumentChatGptPlanActionLabel(state.mode))}</button>}
                    {apiConnectionAvailable && ai.state.provider !== null && <button type="button" disabled={pendingAiConfirmation !== null} onClick={() => prepareConnectedAi(ai.state.provider === "openai" ? "OpenAI" : "Gemini", selectOfficialDocumentAiGenerator("apiConnection", { apiConnection: apiAiService.generate, chatGptPlan: chatGptPlanAiService.generate }))}>{routeActionLabel(ai.state.provider === "openai" ? "OpenAI로" : "Gemini로", getOfficialDocumentAiActionLabel(ai.state.provider, state.mode))}</button>}
                  </>
                )}
                </div>
              </div>
              {state.aiStatus === "generating" && <p className="official-document-prompt-help">화면 반영만 중단할 수 있으며 이미 전송된 요청은 회수되지 않습니다.</p>}
              <p className="official-document-prompt-help">공문 내용과 요청사항을 정리해 ChatGPT, Gemini 등에서 사용할 수 있는 프롬프트를 만듭니다.</p>
              <aside className="official-document-privacy">
                <ShieldAlert size={16} />
                <span>
                  {privacyNoticeParts.map((part) =>
                    part === "탐지하지 못할 수 있습니다." || part === "AI 서비스로"
                      ? <span className="official-document-privacy__nowrap" key={part}>{part}</span>
                      : part
                  )}
                </span>
              </aside>
              {apiConnectionAvailable || chatGptPlanAvailable ? (
                <div className="official-document-ai-state official-document-ai-state--routes">
                  {chatGptPlanAvailable && selectedChatGptModelLabel !== null && <span><CircleCheck size={15} /> ChatGPT 요금제 연결됨 · {selectedChatGptModelLabel}</span>}
                  {apiConnectionAvailable && ai.state.provider !== null && <span><CircleCheck size={15} /> {ai.state.provider === "openai" ? "OpenAI" : "Gemini"} 연결됨</span>}
                  {chatGptPlanUsageAvailable && !chatGptPlanAvailable && <span>{chatGpt.modelsLoading ? "ChatGPT 모델을 준비 중입니다." : chatGpt.modelsError?.message ?? "ChatGPT 모델을 선택해 주세요."}</span>}
                </div>
              ) : chatGptPlanUsageAvailable ? (
                <div className="official-document-ai-state"><span>{chatGpt.modelsLoading ? "ChatGPT 모델을 준비 중입니다." : chatGpt.modelsError?.message ?? "ChatGPT 모델을 선택해 주세요."}</span><button type="button" onClick={onOpenAiSettings}>AI 연결 설정</button></div>
              ) : (
                <div className="official-document-ai-state"><span>AI 서비스가 연결되지 않았습니다.</span><button type="button" onClick={onOpenAiSettings}>AI 연결 설정</button></div>
              )}
              {state.aiError !== null && <p className="official-document-error" role="alert">{state.aiError}</p>}
            </section>
          </div>
          <OfficialDocumentOutput aiResponse={output.aiResponse} aiStatus={state.aiStatus} draft={state.mode === "create" ? state.draft : null} isExportingOdt={isExportingOdt} localSummary={state.mode === "summary" ? state.summaryLocalResult : null} mode={state.mode} prompt={output.prompt} onCopy={(label, value) => void copy(label, value)} onExportOdt={() => void exportOdt()} onSendSummaryToQuickAdd={() => {
            if (state.summaryLocalResult !== null) {
              onSendSummaryToQuickAdd(createOfficialDocumentQuickAddDraft(state.summaryLocalResult));
            }
          }} />
        </div>
        {pendingAiConfirmation !== null && (
          <OfficialDocumentAiConfirmation
            confirmation={pendingAiConfirmation}
            onCancel={cancelConnectedAi}
            onConfirm={(result) => void confirmConnectedAi(result)}
          />
        )}
        {pendingReferenceApplication !== null && (
          <OfficialDocumentReferenceConfirmation
            changedFields={pendingReferenceApplication.application.changedFields}
            reference={pendingReferenceApplication.reference}
            onCancel={() => setPendingReferenceApplication(null)}
            onConfirm={confirmReferenceApplication}
          />
        )}
        <footer>입력과 결과는 현재 앱을 실행하는 동안에만 메모리에 유지되며 자동 저장되지 않습니다.</footer>
      </section>
    </div>
  );
}
