import { AlertTriangle, Files, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import type {
  RecordHelperReport,
  RecordHelperWorkspace,
  RecordHelperWorkspaceAction,
} from "../../../record-helper/recordHelperWorkspace";
import { RecordHelperReportDetail } from "./RecordHelperReportDetail";
import { RecordHelperReportList } from "./RecordHelperReportList";
import type { RecordHelperChatGptPlanAvailability } from "../../../record-helper/recordHelperAiService";

type RecordHelperWorkspaceViewProps = {
  readonly dispatch: Dispatch<RecordHelperWorkspaceAction>;
  readonly workspace: RecordHelperWorkspace;
  readonly aiAvailability: RecordHelperChatGptPlanAvailability;
  readonly onOpenAiSettings: () => void;
  readonly onPrepareAiDraft: (reportId: RecordHelperReport["id"]) => void;
};

const selectedReport = (workspace: RecordHelperWorkspace): RecordHelperReport | null => (
  workspace.reports.find((report) => report.id === workspace.selectedReportId) ?? workspace.reports[0] ?? null
);

function RecordHelperImportFeedback({ workspace }: { readonly workspace: RecordHelperWorkspace }) {
  if (workspace.importError === null && workspace.latestBatchFailures.length === 0) return null;

  return (
    <section className="record-helper-failures" role="alert" aria-label="가져오지 못한 파일">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        {workspace.importError !== null && <strong>{workspace.importError}</strong>}
        {workspace.latestBatchFailures.length > 0 && (
          <>
            <strong>{workspace.reports.length === 0 ? "파일을 가져오지 못했습니다." : "일부 파일은 가져오지 못했습니다."}</strong>
            <ul>
              {workspace.latestBatchFailures.map((failure) => (
                <li key={`${failure.sourceName}-${failure.error}`}>{failure.sourceName}: {failure.error}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

export function RecordHelperWorkspaceView({ dispatch, workspace, aiAvailability, onOpenAiSettings, onPrepareAiDraft }: RecordHelperWorkspaceViewProps) {
  const report = selectedReport(workspace);

  if (workspace.reports.length === 0) {
    return (
      <section className="record-helper-empty" aria-live="polite">
        <Files size={22} aria-hidden="true" />
        <strong>아직 가져온 활동보고서가 없습니다.</strong>
        <span>활동보고서 파일 추가로 PDF, HWP/HWPX, DOCX 보고서의 텍스트를 로컬에서 읽어 옵니다.</span>
        <RecordHelperImportFeedback workspace={workspace} />
      </section>
    );
  }

  return (
    <div className="record-helper-workspace">
      <RecordHelperReportList
        reports={workspace.reports}
        selectedReportId={workspace.selectedReportId}
        onRemove={(reportId) => dispatch({ type: "removeReport", reportId })}
        onSelect={(reportId) => dispatch({ type: "selectReport", reportId })}
      />
      <div className="record-helper-workspace__main">
        <RecordHelperImportFeedback workspace={workspace} />
        {report !== null && (
          <RecordHelperReportDetail
            report={report}
            onMemoChange={(reportId, teacherMemo) => dispatch({ type: "updateTeacherMemo", reportId, teacherMemo })}
            onMetadataChange={(reportId, metadata) => dispatch({ type: "updateReportMetadata", reportId, metadata })}
            onRemove={(reportId) => dispatch({ type: "removeReport", reportId })}
            aiAvailability={aiAvailability}
            onOpenAiSettings={onOpenAiSettings}
            onPrepareAiDraft={onPrepareAiDraft}
          />
        )}
        <button className="record-helper-clear" type="button" onClick={() => dispatch({ type: "clearAll" })}>
          <Trash2 size={14} aria-hidden="true" />
          전체 비우기
        </button>
      </div>
    </div>
  );
}
