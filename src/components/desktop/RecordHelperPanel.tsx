import { BookOpenCheck, CircleCheck, ShieldAlert, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useChatGptConnection } from "../../chatgpt/ChatGptConnectionContext";
import { buildRecordHelperPrompt } from "../../record-helper/promptBuilder";
import { recordHelperPrivacyNotice } from "../../record-helper/privacyGuard";
import {
  nextRecordHelperAiRequestId,
  prepareRecordHelperAiSend,
  resolveRecordHelperChatGptPlanAvailability,
  type RecordHelperAiSendGate,
} from "../../record-helper/recordHelperAiService";
import { createRecordHelperSession, reduceRecordHelperSession } from "../../record-helper/recordHelperSession";
import { RecordHelperAiConfirmation } from "./RecordHelperAiConfirmation";

type RecordHelperPanelProps = {
  readonly onClose: () => void;
  readonly onOpenAiSettings: () => void;
};

type PendingAiConfirmation = {
  readonly gate: RecordHelperAiSendGate;
  readonly prompt: string;
  readonly providerLabel: string;
};

export function RecordHelperAiOutput({ response }: { readonly response: string }) {
  return (
    <section className="record-helper-panel__output" aria-labelledby="record-helper-output-title">
      <div>
        <strong id="record-helper-output-title">AI 생성 결과</strong>
        <span>AI가 작성한 초안입니다. 실제 학생부 입력 전 교사가 사실관계와 표현을 확인해 주세요.</span>
      </div>
      <pre tabIndex={0}>{response}</pre>
    </section>
  );
}

export function RecordHelperPanel({ onClose, onOpenAiSettings }: RecordHelperPanelProps) {
  const chatGpt = useChatGptConnection();
  const [session, dispatch] = useReducer(reduceRecordHelperSession, undefined, createRecordHelperSession);
  const [pendingAiConfirmation, setPendingAiConfirmation] = useState<PendingAiConfirmation | null>(null);
  const activityMemoRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const aiErrorRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const confirmingGateRef = useRef<RecordHelperAiSendGate | null>(null);
  const planAvailability = useMemo(() => resolveRecordHelperChatGptPlanAvailability({
    status: chatGpt.state.status,
    planUsageEnabled: chatGpt.state.planUsageEnabled,
    models: chatGpt.models,
    selectedModel: chatGpt.selectedModel,
    modelsLoading: chatGpt.modelsLoading,
    modelsError: chatGpt.modelsError,
  }), [
    chatGpt.models,
    chatGpt.modelsError,
    chatGpt.modelsLoading,
    chatGpt.selectedModel,
    chatGpt.state.planUsageEnabled,
    chatGpt.state.status,
  ]);

  useEffect(() => {
    activityMemoRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pendingAiConfirmation === null) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, pendingAiConfirmation]);

  useEffect(() => {
    if (session.check.status !== "idle") {
      statusRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [session.check.status]);

  useEffect(() => {
    if (session.aiStatus === "error") {
      aiErrorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [session.aiStatus]);

  useEffect(() => {
    if (session.aiStatus === "success") {
      outputRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [session.aiStatus]);

  const cancelPendingConfirmation = (): void => {
    pendingAiConfirmation?.gate.cancel();
    setPendingAiConfirmation(null);
  };

  const updateActivityMemo = (value: string): void => {
    cancelPendingConfirmation();
    dispatch({ type: "updateActivityMemo", value });
  };

  const updateWritingRequest = (value: string): void => {
    cancelPendingConfirmation();
    dispatch({ type: "updateWritingRequest", value });
  };

  const prepareChatGptPlan = (): void => {
    if (!planAvailability.isAvailable || planAvailability.selectedModel === null) return;
    const prepared = prepareRecordHelperAiSend({
      activityMemo: session.activityMemo,
      writingRequest: session.writingRequest,
      buildPrompt: buildRecordHelperPrompt,
      generate: chatGpt.generateText,
    });
    if (prepared.status !== "ready") {
      dispatch({ type: "checkInput" });
      return;
    }
    setPendingAiConfirmation({
      gate: prepared.gate,
      prompt: prepared.prompt,
      providerLabel: `ChatGPT 요금제 · ${planAvailability.selectedModel.displayName}`,
    });
  };

  const confirmChatGptPlan = async (): Promise<void> => {
    const confirmation = pendingAiConfirmation;
    if (confirmation === null || confirmingGateRef.current === confirmation.gate) return;
    confirmingGateRef.current = confirmation.gate;
    setPendingAiConfirmation(null);
    const requestId = nextRecordHelperAiRequestId();
    dispatch({ type: "beginAiRequest", requestId });
    try {
      const response = await confirmation.gate.confirm();
      if (response !== null) dispatch({ type: "resolveAiRequest", requestId, response });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "ChatGPT 요금제 작성에 실패했습니다.";
      dispatch({ type: "failAiRequest", requestId, error: message });
    } finally {
      if (confirmingGateRef.current === confirmation.gate) confirmingGateRef.current = null;
    }
  };

  return (
    <div className="record-helper-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="record-helper-panel" role="dialog" aria-modal="true" aria-labelledby="record-helper-title" aria-describedby="record-helper-description">
        <header>
          <div className="record-helper-panel__title-icon"><BookOpenCheck size={18} /></div>
          <div>
            <strong id="record-helper-title">생기부 도우미</strong>
            <span id="record-helper-description">비식별 활동·관찰 메모를 정리해 기록 문구를 준비합니다.</span>
          </div>
          <button type="button" aria-label="생기부 도우미 닫기" onClick={onClose}><X size={16} /></button>
        </header>

        <div className="record-helper-panel__body">
          <div className="record-helper-panel__privacy" role="note">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <strong>학생 이름·학번·연락처·건강정보 등 개인을 식별할 수 있는 정보는 입력하지 마세요.</strong>
              <span>{recordHelperPrivacyNotice}</span>
            </div>
          </div>

          <div className={`record-helper-panel__ai-state${planAvailability.isAvailable ? " is-available" : ""}`} aria-live="polite">
            <span>
              {planAvailability.isAvailable && <CircleCheck size={15} aria-hidden="true" />}
              {planAvailability.message}
            </span>
            {!planAvailability.isAvailable && !chatGpt.modelsLoading && (
              <button type="button" onClick={onOpenAiSettings}>AI 연결 설정</button>
            )}
          </div>

          <label className="record-helper-panel__field" htmlFor="record-helper-activity-memo">
            <span><strong>비식별 활동·관찰 메모</strong><small>필수</small></span>
            <textarea
              ref={activityMemoRef}
              id="record-helper-activity-memo"
              value={session.activityMemo}
              placeholder="예: 모둠 활동에서 자료를 정리하고 발표 준비에 꾸준히 참여함"
              onChange={(event) => updateActivityMemo(event.currentTarget.value)}
            />
          </label>

          <label className="record-helper-panel__field" htmlFor="record-helper-writing-request">
            <span><strong>작성 요청 / 강조할 점</strong><small>선택</small></span>
            <textarea
              id="record-helper-writing-request"
              value={session.writingRequest}
              placeholder="예: 협업 과정과 책임감을 중심으로 정리"
              onChange={(event) => updateWritingRequest(event.currentTarget.value)}
            />
          </label>

          <div ref={statusRef} className={`record-helper-panel__status is-${session.check.status}`} aria-live="polite">
            {session.check.status === "idle" && "입력 내용은 이 화면의 메모리에만 유지됩니다."}
            {session.check.status === "empty" && session.check.message}
            {session.check.status === "blocked" && (
              <>
                <strong>개인정보 또는 민감정보로 보이는 내용이 있어 점검을 중단했습니다.</strong>
                <span>확인 항목: {session.check.findings.join(", ")}</span>
              </>
            )}
            {session.check.status === "ready" && session.check.message}
          </div>

          {session.aiStatus === "error" && session.aiError !== null && (
            <div ref={aiErrorRef} className="record-helper-panel__ai-error" role="alert">{session.aiError}</div>
          )}

          {session.aiStatus === "success" && session.aiResponse !== "" && (
            <div ref={outputRef}><RecordHelperAiOutput response={session.aiResponse} /></div>
          )}
        </div>

        <footer>
          <span>입력과 결과는 현재 앱 메모리에만 유지되며 자동 저장되지 않습니다.</span>
          <div className="record-helper-panel__actions">
            <button type="button" onClick={() => dispatch({ type: "checkInput" })}>
              <BookOpenCheck size={15} /> 입력 내용 점검
            </button>
            {planAvailability.isAvailable && (
              <button className="is-primary" type="button" disabled={session.aiStatus === "generating" || pendingAiConfirmation !== null} onClick={prepareChatGptPlan}>
                <Sparkles size={15} /> {session.aiStatus === "generating" ? "작성 중…" : "ChatGPT 요금제로 작성"}
              </button>
            )}
          </div>
        </footer>

        {pendingAiConfirmation !== null && (
          <RecordHelperAiConfirmation
            confirmation={pendingAiConfirmation}
            onCancel={cancelPendingConfirmation}
            onConfirm={() => void confirmChatGptPlan()}
          />
        )}
      </section>
    </div>
  );
}
