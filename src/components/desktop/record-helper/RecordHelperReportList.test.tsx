import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createRecordHelperReportId, type RecordHelperReport } from "../../../record-helper/recordHelperWorkspace";
import { RecordHelperReportList } from "./RecordHelperReportList";

const report = (id: string, aiStatus: RecordHelperReport["aiStatus"]): RecordHelperReport => ({
  id: createRecordHelperReportId(id),
  sourceName: `${id}.pdf`,
  format: "pdf",
  extractedText: "합성 활동보고서",
  studentLabel: "",
  classLabel: "",
  activityLabel: "",
  teacherMemo: "",
  aiStatus,
  aiDraft: aiStatus === "success" ? "비식별 AI 초안" : "",
  aiError: aiStatus === "error" ? "생성 오류" : null,
  activeAiRequestId: aiStatus === "generating" ? 1 : null,
});

describe("RecordHelperReportList", () => {
  it("maps every AI status to a precise progress label", () => {
    const markup = renderToStaticMarkup(
      <RecordHelperReportList
        reports={[
          report("idle", "idle"),
          report("generating", "generating"),
          report("success", "success"),
          report("error", "error"),
        ]}
        selectedReportId={createRecordHelperReportId("idle")}
        onRemove={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(markup).toContain("작성 전");
    expect(markup).toContain("작성 중");
    expect(markup).toContain("초안 생성됨");
    expect(markup).toContain("오류");
    expect(markup).not.toContain(">완료<");
  });
});
