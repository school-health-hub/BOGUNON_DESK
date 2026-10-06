import { Trash2 } from "lucide-react";
import type { RecordHelperReport, RecordHelperReportId } from "../../../record-helper/recordHelperWorkspace";
import { RecordHelperFormatBadge } from "./RecordHelperFormatBadge";

type RecordHelperReportListProps = {
  readonly reports: readonly RecordHelperReport[];
  readonly selectedReportId: RecordHelperReportId | null;
  readonly onRemove: (reportId: RecordHelperReportId) => void;
  readonly onSelect: (reportId: RecordHelperReportId) => void;
};

const aiStatusLabels: Record<RecordHelperReport["aiStatus"], string> = {
  idle: "작성 전",
  generating: "작성 중",
  success: "초안 생성됨",
  error: "오류",
};

export function RecordHelperReportList({
  reports,
  selectedReportId,
  onRemove,
  onSelect,
}: RecordHelperReportListProps) {
  return (
    <aside className="record-helper-workspace__list" aria-label="가져온 활동보고서 목록">
      <div className="record-helper-workspace__list-summary">
        <strong>{reports.length}개 보고서</strong>
        <span>현재 작업실</span>
      </div>
      <div role="list">
        {reports.map((report) => (
          <div className="record-helper-report-row" role="listitem" key={report.id}>
            <button
              type="button"
              className={report.id === selectedReportId ? "is-selected" : ""}
              aria-current={report.id === selectedReportId ? "true" : undefined}
              onClick={() => onSelect(report.id)}
            >
              <span>
                <strong title={report.sourceName}>{report.sourceName}</strong>
                <small>{report.studentLabel || "학생 구분 없음"} · {report.activityLabel || "활동 미정"}</small>
                <em className={`record-helper-report-status is-${report.aiStatus}`}>{aiStatusLabels[report.aiStatus]}</em>
              </span>
              <RecordHelperFormatBadge format={report.format} />
            </button>
            <button type="button" aria-label={`${report.sourceName} 제거`} onClick={() => onRemove(report.id)}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
