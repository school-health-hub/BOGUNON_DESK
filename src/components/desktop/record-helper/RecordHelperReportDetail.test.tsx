import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createRecordHelperReportId, type RecordHelperReport } from "../../../record-helper/recordHelperWorkspace";
import type { RecordHelperChatGptPlanAvailability } from "../../../record-helper/recordHelperAiService";
import { RecordHelperReportDetail } from "./RecordHelperReportDetail";

const available: RecordHelperChatGptPlanAvailability = {
  isAvailable: true,
  selectedModel: { slug: "gpt-test", displayName: "GPT Test" },
  message: "ChatGPT 요금제 연결됨 · GPT Test",
};

const report = (aiDraft: string): RecordHelperReport => ({
  id: createRecordHelperReportId("report-a"),
  sourceName: "합성-활동보고서.pdf",
  format: "pdf",
  extractedText: "합성 원문이며 실제 학생정보가 없습니다.",
  studentLabel: "",
  classLabel: "",
  activityLabel: "",
  teacherMemo: "",
  aiStatus: aiDraft === "" ? "idle" : "success",
  aiDraft,
  aiError: null,
  activeAiRequestId: null,
});

const renderDetail = (aiDraft: string, currentIndex = 0, totalCount = 2): string => renderToStaticMarkup(
  <RecordHelperReportDetail
    report={report(aiDraft)}
    currentIndex={currentIndex}
    totalCount={totalCount}
    previousReportId={currentIndex === 0 ? null : createRecordHelperReportId("previous")}
    nextReportId={currentIndex === totalCount - 1 ? null : createRecordHelperReportId("next")}
    onMemoChange={vi.fn()}
    onMetadataChange={vi.fn()}
    onRemove={vi.fn()}
    onSelect={vi.fn()}
    aiAvailability={available}
    onOpenAiSettings={vi.fn()}
    onPrepareAiDraft={vi.fn()}
  />,
);

describe("RecordHelperReportDetail", () => {
  it("shows report position and disables navigation at boundaries", () => {
    const first = renderDetail("", 0, 2);
    const last = renderDetail("", 1, 2);

    expect(first).toContain("1 / 2");
    expect(first).toMatch(/aria-label="이전 보고서"[^>]*disabled/);
    expect(first).not.toMatch(/aria-label="다음 보고서"[^>]*disabled/);
    expect(last).toContain("2 / 2");
    expect(last).not.toMatch(/aria-label="이전 보고서"[^>]*disabled/);
    expect(last).toMatch(/aria-label="다음 보고서"[^>]*disabled/);
  });

  it("shows the copy action only for a non-empty successful AI draft", () => {
    const success = renderDetail("비식별 AI 초안");
    const idle = renderDetail("");

    expect(success).toContain("초안 생성됨");
    expect(success).toContain("결과 복사");
    expect(success).toContain("비식별 AI 초안");
    expect(success).not.toContain("합성 원문이며 실제 학생정보가 없습니다.비식별 AI 초안");
    expect(idle).not.toContain("결과 복사");
  });

  it("marks the AI draft with the local Korean wrapping style contract", () => {
    expect(renderDetail("긴 한국어 AI 초안")).toContain('class="record-helper-ai-result__content"');
  });
});
