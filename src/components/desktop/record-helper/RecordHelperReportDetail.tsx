import { Trash2 } from "lucide-react";
import type {
  RecordHelperReport,
  RecordHelperReportId,
  RecordHelperReportMetadata,
} from "../../../record-helper/recordHelperWorkspace";
import { RecordHelperFormatBadge } from "./RecordHelperFormatBadge";

type RecordHelperReportDetailProps = {
  readonly report: RecordHelperReport;
  readonly onMemoChange: (reportId: RecordHelperReportId, teacherMemo: string) => void;
  readonly onMetadataChange: (reportId: RecordHelperReportId, metadata: RecordHelperReportMetadata) => void;
  readonly onRemove: (reportId: RecordHelperReportId) => void;
};

export function RecordHelperReportDetail({
  report,
  onMemoChange,
  onMetadataChange,
  onRemove,
}: RecordHelperReportDetailProps) {
  const updateMetadata = (field: keyof RecordHelperReportMetadata, value: string): void => {
    onMetadataChange(report.id, { studentLabel: report.studentLabel, classLabel: report.classLabel, activityLabel: report.activityLabel, [field]: value });
  };

  return (
    <section className="record-helper-detail" aria-labelledby="record-helper-detail-title">
      <header>
        <div>
          <strong id="record-helper-detail-title" title={report.sourceName}>{report.sourceName}</strong>
          <span>선택한 보고서 원문과 교사 메모</span>
        </div>
        <RecordHelperFormatBadge format={report.format} />
      </header>
      <div className="record-helper-detail__labels" aria-label="보고서 분류 메모">
        <label>
          <span>학생 구분</span>
          <input value={report.studentLabel} placeholder="예: 2학년 3반 15번" onChange={(event) => updateMetadata("studentLabel", event.currentTarget.value)} />
        </label>
        <label>
          <span>학급/그룹</span>
          <input value={report.classLabel} placeholder="예: 2학년 3반" onChange={(event) => updateMetadata("classLabel", event.currentTarget.value)} />
        </label>
        <label>
          <span>활동명</span>
          <input value={report.activityLabel} placeholder="예: 학급자치" onChange={(event) => updateMetadata("activityLabel", event.currentTarget.value)} />
        </label>
      </div>
      <label className="record-helper-detail__text">
        <span>추출된 원문</span>
        <textarea readOnly value={report.extractedText} />
      </label>
      <label className="record-helper-detail__memo">
        <span>교사 메모/관찰 내용</span>
        <textarea value={report.teacherMemo} placeholder="학생부 문구 작성 전 확인할 관찰 포인트를 적어 둡니다." onChange={(event) => onMemoChange(report.id, event.currentTarget.value)} />
      </label>
      <button className="record-helper-detail__remove" type="button" onClick={() => onRemove(report.id)}>
        <Trash2 size={14} aria-hidden="true" />
        선택 보고서 제거
      </button>
    </section>
  );
}
