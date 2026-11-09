import { BookOpenText, FilePlus2, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {ChatGptConnectionStatus,ChatGptModel,ChatGptPlanError} from "../../chatgpt/types";
import { deidentifyRecordHelperContent } from "../../record-helper/deidentification";
import { createRecordHelperAiSendGate, nextRecordHelperAiRequestId, resolveRecordHelperChatGptPlanAvailability } from "../../record-helper/recordHelperAiService";
import type { RecordHelperImportBatch } from "../../record-helper/reportImportService";
import {
  createRecordHelperReportId,
  createRecordHelperWorkspace,
  hasRecordHelperUserWork,
  reduceRecordHelperWorkspace,
  type RecordHelperImportedReport,
  type RecordHelperImportFailure,
  type RecordHelperWorkspace,
} from "../../record-helper/recordHelperWorkspace";
import { RecordHelperWorkspaceView } from "./record-helper/RecordHelperWorkspaceView";
import {
  RecordHelperAiConfirmation,
  type RecordHelperAiConfirmationData,
  type RecordHelperAiConfirmationResult,
} from "./RecordHelperAiConfirmation";
import { RecordHelperDiscardConfirmation, type RecordHelperDiscardRequest } from "./RecordHelperDiscardConfirmation";

type ImportReports = () => Promise<RecordHelperImportBatch | null>;

export type RecordHelperConnection={state:{status:ChatGptConnectionStatus;planUsageEnabled:boolean};models:readonly ChatGptModel[];selectedModel:string|null;modelsLoading:boolean;modelsError:ChatGptPlanError|null;generateText:(prompt:string)=>Promise<string>};
export type RecordHelperWorkspacePanelProps = {
  readonly chatGpt:RecordHelperConnection;
  readonly onGenerateReviewed?:(request:{reportId:string;requestId:number;packet:{reportText:string;teacherMemo:string};identityHints:readonly string[]})=>Promise<string>;
  readonly onCancelAi?:(reportId:string)=>void;
  readonly onDiscardWork?:(reportId?:string)=>void;
  readonly onCancelImport?:()=>void;
  readonly onRefreshConnection?:()=>void;
  readonly electronSession?:boolean;
  readonly importLabel?:string;
  readonly onCancelDropped?:()=>void;
  readonly importReports: ImportReports;
  readonly initialImportBatch?: RecordHelperImportBatch | null;
  readonly onInitialImportConsumed?: () => void;
  readonly initialWorkspace?: RecordHelperWorkspace;
  readonly onClose: () => void;
  readonly onOpenAiSettings: () => void;
};

type PendingConfirmation = RecordHelperAiConfirmationData & { readonly reportId: string };

const importFailureMessage = "활동보고서 파일을 가져오지 못했습니다.";

const assertNever = (value: never): never => {
  throw new TypeError(`지원하지 않는 생기부 도우미 폐기 요청: ${String(value)}`);
};

const createWorkspaceReport = (
  report: RecordHelperImportBatch["reports"][number],
  requestId: number,
  index: number,
): RecordHelperImportedReport => ({
  id: createRecordHelperReportId(`${requestId}-${index}-${report.sourceName}`),
  sourceName: report.sourceName,
  format: report.format,
  extractedText: report.text,
});

const createWorkspaceFailure = (failure: RecordHelperImportBatch["failures"][number]): RecordHelperImportFailure => ({
  sourceName: failure.sourceName,
  error: failure.message,
});

export function RecordHelperWorkspacePanel({
  chatGpt,onGenerateReviewed,onCancelAi,onDiscardWork,onCancelImport,onRefreshConnection,electronSession=false,importLabel,onCancelDropped,
  importReports,
  initialImportBatch = null,
  onInitialImportConsumed,
  initialWorkspace,
  onClose,
  onOpenAiSettings,
}: RecordHelperWorkspacePanelProps) {
  const [workspace, rawDispatch] = useReducer(
    reduceRecordHelperWorkspace,
    initialWorkspace ?? createRecordHelperWorkspace(),
  );
  const dispatch:typeof rawDispatch=(action)=>{
    if(action.type==='updateAiDraft')onCancelAi?.(action.reportId);
    if(action.type==='updateTeacherMemo'||action.type==='updateReportMetadata'){
      const old=workspace.reports.find(r=>r.id===action.reportId);
      if(old?.activeAiRequestId!==null&&(action.type==='updateTeacherMemo'?old?.teacherMemo!==action.teacherMemo:old?.studentLabel!==action.metadata.studentLabel||old?.classLabel!==action.metadata.classLabel))onCancelAi?.(action.reportId);
    }
    rawDispatch(action);
  };
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const requestIdRef = useRef(0);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<RecordHelperDiscardRequest | null>(null);
  const availability = resolveRecordHelperChatGptPlanAvailability({
    status: chatGpt.state.status,
    planUsageEnabled: chatGpt.state.planUsageEnabled,
    models: chatGpt.models,
    selectedModel: chatGpt.selectedModel,
    modelsLoading: chatGpt.modelsLoading,
    modelsError: chatGpt.modelsError,
  });

  const prepareAiDraft = (reportId: string): void => {
    const report = workspace.reports.find((candidate) => candidate.id === reportId);
    if (report === undefined || !availability.isAvailable || availability.selectedModel === null) return;
    const sanitized = deidentifyRecordHelperContent({
      reportText: report.extractedText,
      teacherMemo: report.teacherMemo,
      studentLabel: report.studentLabel,
      classLabel: report.classLabel,
    });
    const initialPacket = report.reviewedSanitizedPacket ?? sanitized;
    setConfirmation({
      reportId,
      providerLabel: `ChatGPT 요금제 · ${availability.selectedModel.displayName}`,
      reportText: initialPacket.reportText,
      teacherMemo: initialPacket.teacherMemo,
      redactionCount: sanitized.redactions.length,
      identityHints: [report.studentLabel, report.classLabel],
    });
  };

  const generateAiDraft = (reportId: string, result: RecordHelperAiConfirmationResult): void => {
    const requestId = nextRecordHelperAiRequestId();
    const report=workspace.reports.find(r=>r.id===reportId);if(!report)return;
    const gate = createRecordHelperAiSendGate(result.prompt,onGenerateReviewed?()=>onGenerateReviewed({reportId,requestId,packet:result.reviewedPacket,identityHints:[report.studentLabel,report.classLabel]}):chatGpt.generateText);
    setConfirmation(null);
    dispatch({ type: "storeReviewedSanitizedPacket", reportId, packet: result.reviewedPacket });
    dispatch({ type: "beginAiRequest", reportId, requestId });
    void gate.confirm().then(
      (response) => { if (response !== null) dispatch({ type: "resolveAiRequest", reportId, requestId, response }); },
      (error: unknown) => dispatch({ type: "failAiRequest", reportId, requestId, error: error instanceof Error ? error.message : "AI 초안을 작성하지 못했습니다." }),
    );
  };

  const requestClose = useCallback((): void => {
    if (workspace.reports.length === 0) {
      onClose();
      return;
    }
    setPendingDiscard({ kind: "close" });
  }, [onClose, workspace.reports.length]);

  const requestClearAll = (): void => {
    if (workspace.reports.length === 0) return;
    setPendingDiscard({ kind: "clear" });
  };

  const requestRemoveReport = (reportId: string): void => {
    const report = workspace.reports.find((candidate) => candidate.id === reportId);
    if (report === undefined) return;
    if (!electronSession&&!hasRecordHelperUserWork(report)) {
      dispatch({ type: "removeReport", reportId });
      return;
    }
    setPendingDiscard({ kind: "remove", reportId, sourceName: report.sourceName });
  };

  const confirmDiscard = (): void => {
    if (pendingDiscard === null) return;
    onDiscardWork?.(pendingDiscard.kind==='remove'?pendingDiscard.reportId:undefined);
    switch (pendingDiscard.kind) {
      case "close":
        setPendingDiscard(null);
        onClose();
        return;
      case "clear":
        dispatch({ type: "clearAll" });
        break;
      case "remove":
        dispatch({ type: "removeReport", reportId: pendingDiscard.reportId });
        break;
      default:
        return assertNever(pendingDiscard);
    }
    setPendingDiscard(null);
  };

  useEffect(() => {
    if (initialImportBatch === null) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    dispatch({ type: "beginImport", requestId });
    dispatch({
      type: "resolveImport",
      requestId,
      reports: initialImportBatch.reports.map((report, index) => createWorkspaceReport(report, requestId, index)),
      failures: initialImportBatch.failures.map(createWorkspaceFailure),
    });
    onInitialImportConsumed?.();
  }, [initialImportBatch, onInitialImportConsumed]);

  useEffect(() => {
    importButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmation !== null) {
        setConfirmation(null);
        return;
      }
      if (pendingDiscard !== null) {
        setPendingDiscard(null);
        return;
      }
      requestClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmation, pendingDiscard, requestClose]);

  const addReports = async (): Promise<void> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    dispatch({ type: "beginImport", requestId });
    try {
      const batch = await importReports();
      if (batch === null) {
        dispatch({ type: "resolveImport", requestId, reports: [], failures: [] });
        return;
      }
      if(electronSession&&(workspace.reports.length+batch.reports.length>50||[...workspace.reports.map(r=>r.extractedText),...batch.reports.map(r=>r.text)].reduce((n,text)=>n+new TextEncoder().encode(text).length,0)>20*1024*1024))throw new Error('작업실은 최대 50개·총 추출 텍스트 20MiB까지 처리합니다. 기존 보고서를 정리해 주세요.');
      dispatch({
        type: "resolveImport",
        requestId,
        reports: batch.reports.map((report, index) => createWorkspaceReport(report, requestId, index)),
        failures: batch.failures.map(createWorkspaceFailure),
      });
    } catch (error: unknown) {
      dispatch({
        type: "failImport",
        requestId,
        error: error instanceof Error ? error.message : importFailureMessage,
        failures: [],
      });
    }
  };

  return (
    <div className="record-helper-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className="record-helper-panel" role="dialog" aria-modal="true" aria-labelledby="record-helper-title" aria-describedby="record-helper-description">
        <header>
          <div className="record-helper-panel__title-icon"><BookOpenText size={18} aria-hidden="true" /></div>
          <div>
            <strong id="record-helper-title">생기부 도우미</strong>
            <span id="record-helper-description">학생 활동보고서를 불러와 학생별 기록 자료를 정리합니다.</span>
          </div>
          <button type="button" aria-label="생기부 도우미 닫기" onClick={requestClose}><X size={16} aria-hidden="true" /></button>
        </header>

        <div className="record-helper-panel__body">
          <div className="record-helper-panel__toolbar" aria-label="활동보고서 가져오기">
            <button
              ref={importButtonRef}
              type="button"
              disabled={workspace.importStatus === "importing"}
              onClick={() => void addReports()}
            >
              <FilePlus2 size={16} aria-hidden="true" />
              {workspace.importStatus === "importing" ? "가져오는 중" : importLabel??"활동보고서 파일 추가"}
            </button>
            {workspace.importStatus==='importing'&&onCancelImport&&<button type="button" onClick={()=>{const requestId=requestIdRef.current++;onCancelImport();dispatch({type:'resolveImport',requestId,reports:[],failures:[]});}}>가져오기 취소</button>}
            {onCancelDropped&&<button type="button" disabled={workspace.importStatus==='importing'} onClick={onCancelDropped}>드롭 파일 취소</button>}
            {onRefreshConnection&&<button type="button" onClick={onRefreshConnection}>ChatGPT 연결 상태 새로고침</button>}
            <span className="record-helper-panel__formats">PDF · HWP/HWPX · DOCX</span>
            <small>HWP 5.x 일반/압축 문서</small>
          </div>

          <div className="record-helper-panel__privacy" role="note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>가져온 원본과 현재 작업은 앱 메모리에서만 처리합니다.</strong>
              <span>생기부 도우미를 닫거나 앱을 완전히 종료하면 현재 작업이 모두 사라집니다.</span>
              <details>
                <summary>개인정보 처리 원칙</summary>
                <span>원문, 학생정보, 교사 메모, 검토한 전송본과 AI 초안은 장기 저장하지 않습니다.</span>
                <span>AI 전송 전 개인정보를 비식별 처리하고, 실제 전송 내용을 직접 확인합니다.</span>
              </details>
            </div>
          </div>

          <RecordHelperWorkspaceView
            editableDraft={electronSession}
            workspace={workspace}
            dispatch={dispatch}
            aiAvailability={availability}
            onOpenAiSettings={onOpenAiSettings}
            onPrepareAiDraft={prepareAiDraft}
            onCancelAiDraft={(reportId, requestId) => {onCancelAi?.(reportId);dispatch({ type: "cancelAiRequest", reportId, requestId });}}
            onRemoveReport={requestRemoveReport}
            onClearAll={requestClearAll}
          />
        </div>
      </section>
      {confirmation !== null && (
        <RecordHelperAiConfirmation
          confirmation={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={(result) => generateAiDraft(confirmation.reportId, result)}
        />
      )}
      {pendingDiscard !== null && (
        <RecordHelperDiscardConfirmation
          request={pendingDiscard}
          onCancel={() => setPendingDiscard(null)}
          onConfirm={confirmDiscard}
        />
      )}
    </div>
  );
}
