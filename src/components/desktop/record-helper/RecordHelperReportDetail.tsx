import { ChevronLeft, ChevronRight, ClipboardCopy, Trash2 } from "lucide-react";
import { useState } from "react";
import { copyRecordHelperDraft, type RecordHelperClipboardResult } from "../../../record-helper/recordHelperClipboard";
import type {
  RecordHelperReport,
  RecordHelperReportId,
  RecordHelperReportMetadata,
} from "../../../record-helper/recordHelperWorkspace";
import { RecordHelperFormatBadge } from "./RecordHelperFormatBadge";
import type { RecordHelperChatGptPlanAvailability } from "../../../record-helper/recordHelperAiService";

type RecordHelperReportDetailProps = {
  readonly report: RecordHelperReport;
  readonly currentIndex: number;
  readonly totalCount: number;
  readonly previousReportId: RecordHelperReportId | null;
  readonly nextReportId: RecordHelperReportId | null;
  readonly onMemoChange: (reportId: RecordHelperReportId, teacherMemo: string) => void;
  readonly onMetadataChange: (reportId: RecordHelperReportId, metadata: RecordHelperReportMetadata) => void;
  readonly onRemove: (reportId: RecordHelperReportId) => void;
  readonly onSelect: (reportId: RecordHelperReportId) => void;
  readonly aiAvailability: RecordHelperChatGptPlanAvailability;
  readonly onOpenAiSettings: () => void;
  readonly onPrepareAiDraft: (reportId: RecordHelperReportId) => void;
};

type CopyFeedback = {
  readonly reportId: RecordHelperReportId;
  readonly draft: string;
  readonly result: RecordHelperClipboardResult;
};

export function RecordHelperReportDetail({
  report,
  currentIndex,
  totalCount,
  previousReportId,
  nextReportId,
  onMemoChange,
  onMetadataChange,
  onRemove,
  onSelect,
  aiAvailability,
  onOpenAiSettings,
  onPrepareAiDraft,
}: RecordHelperReportDetailProps) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);

  const updateMetadata = (field: keyof RecordHelperReportMetadata, value: string): void => {
    onMetadataChange(report.id, { studentLabel: report.studentLabel, classLabel: report.classLabel, activityLabel: report.activityLabel, [field]: value });
  };

  const copyDraft = async (): Promise<void> => {
    const result = await copyRecordHelperDraft(
      (value) => navigator.clipboard.writeText(value),
      report.aiDraft,
    );
    setCopyFeedback({ reportId: report.id, draft: report.aiDraft, result });
  };

  return (
    <section className="record-helper-detail" aria-labelledby="record-helper-detail-title">
      <header>
        <div>
          <strong id="record-helper-detail-title" title={report.sourceName}>{report.sourceName}</strong>
          <span>선택한 보고서 원문과 교사 메모</span>
        </div>
        <div className="record-helper-detail__navigation">
          <span className="record-helper-detail__position" aria-label={`현재 보고서 ${currentIndex + 1}, 전체 ${totalCount}`}>{currentIndex + 1} / {totalCount}</span>
          <button type="button" aria-label="이전 보고서" disabled={previousReportId === null} onClick={() => { if (previousReportId !== null) onSelect(previousReportId); }}>
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="다음 보고서" disabled={nextReportId === null} onClick={() => { if (nextReportId !== null) onSelect(nextReportId); }}>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <RecordHelperFormatBadge format={report.format} />
        </div>
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
      <section className="record-helper-ai-result" aria-label="AI 초안">
        <header><strong>AI 초안</strong><span>{aiAvailability.message}</span></header>
        {aiAvailability.isAvailable ? (
          <button type="button" disabled={report.aiStatus === "generating"} onClick={() => onPrepareAiDraft(report.id)}>
            {report.aiStatus === "generating" ? "작성 중…" : "ChatGPT 요금제로 초안 작성"}
          </button>
        ) : aiAvailability.message === "ChatGPT 요금제가 연결되지 않았습니다." ? (
          <button type="button" onClick={onOpenAiSettings}>AI 설정 열기</button>
        ) : (
          <button type="button" disabled>ChatGPT 모델 준비 필요</button>
        )}
        {report.aiStatus === "idle" && <p>작성 전</p>}
        {report.aiStatus === "generating" && <p role="status">작성 중…</p>}
        {report.aiStatus === "success" && <div className="record-helper-ai-result__draft">
          <div className="record-helper-ai-result__draft-heading">
            <strong>초안 생성됨</strong>
            {report.aiDraft.trim() !== "" && (
              <button type="button" onClick={() => void copyDraft()}>
                <ClipboardCopy size={14} aria-hidden="true" /> 결과 복사
              </button>
            )}
          </div>
          <p>AI가 작성한 초안입니다. 실제 학생부 입력 전 교사가 사실관계와 표현을 확인해야 합니다.</p>
          <pre className="record-helper-ai-result__content">{report.aiDraft}</pre>
          {copyFeedback?.reportId === report.id && copyFeedback.draft === report.aiDraft && (
            <p className={`record-helper-ai-result__copy-status is-${copyFeedback.result.status}`} role={copyFeedback.result.status === "error" ? "alert" : "status"} aria-live="polite">
              {copyFeedback.result.message}
            </p>
          )}
        </div>}
        {report.aiStatus === "error" && <div><strong>오류</strong><p role="alert">{report.aiError}</p></div>}
      </section>
      <button className="record-helper-detail__remove" type="button" onClick={() => onRemove(report.id)}>
        <Trash2 size={14} aria-hidden="true" />
        선택 보고서 제거
      </button>
    </section>
  );
}
