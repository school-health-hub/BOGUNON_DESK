import { BookOpenText, FilePlus2, ShieldCheck, X } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import { importRecordHelperReports, type RecordHelperImportBatch } from "../../record-helper/reportImportService";
import {
  createRecordHelperReportId,
  createRecordHelperWorkspace,
  reduceRecordHelperWorkspace,
  type RecordHelperImportedReport,
  type RecordHelperImportFailure,
  type RecordHelperWorkspace,
} from "../../record-helper/recordHelperWorkspace";
import { RecordHelperWorkspaceView } from "./record-helper/RecordHelperWorkspaceView";

type ImportReports = () => Promise<RecordHelperImportBatch | null>;

type RecordHelperPanelProps = {
  readonly importReports?: ImportReports;
  readonly initialWorkspace?: RecordHelperWorkspace;
  readonly onClose: () => void;
};

const importFailureMessage = "활동보고서 파일을 가져오지 못했습니다.";

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

export function RecordHelperPanel({
  importReports = importRecordHelperReports,
  initialWorkspace,
  onClose,
}: RecordHelperPanelProps) {
  const [workspace, dispatch] = useReducer(
    reduceRecordHelperWorkspace,
    initialWorkspace ?? createRecordHelperWorkspace(),
  );
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    importButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
    <div className="record-helper-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="record-helper-panel" role="dialog" aria-modal="true" aria-labelledby="record-helper-title" aria-describedby="record-helper-description">
        <header>
          <div className="record-helper-panel__title-icon"><BookOpenText size={18} aria-hidden="true" /></div>
          <div>
            <strong id="record-helper-title">생기부 도우미</strong>
            <span id="record-helper-description">학생 활동보고서를 불러와 학생별 기록 자료를 정리합니다.</span>
          </div>
          <button type="button" aria-label="생기부 도우미 닫기" onClick={onClose}><X size={16} aria-hidden="true" /></button>
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
              {workspace.importStatus === "importing" ? "가져오는 중" : "활동보고서 파일 추가"}
            </button>
            <span>PDF · HWP/HWPX · DOCX</span>
            <small>HWP 5.x 일반/압축 문서</small>
          </div>

          <div className="record-helper-panel__privacy" role="note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>가져온 원본은 현재 앱 메모리에만 남습니다.</strong>
              <span>원문, 학생정보, 교사 메모는 저장·동기화·업로드하지 않습니다.</span>
              <span>원문 개인정보는 AI로 전송하지 않습니다. 다음 단계에서 비식별 처리와 전송 전 확인을 추가합니다.</span>
            </div>
          </div>

          <div className="record-helper-panel__next-step" role="status">
            <strong>AI 작성 기능 준비 중</strong>
            <span>다음 단계에서 개인정보 비식별 처리와 교사 확인 절차를 거친 뒤 작성 기능을 제공합니다.</span>
          </div>

          <RecordHelperWorkspaceView workspace={workspace} dispatch={dispatch} />
        </div>
      </section>
    </div>
  );
}
