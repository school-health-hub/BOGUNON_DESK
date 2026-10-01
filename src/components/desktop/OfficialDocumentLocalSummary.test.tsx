import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { extractOfficialDocumentSummary } from "../../official-document/summaryExtractor";
import { OfficialDocumentLocalSummaryView } from "./OfficialDocumentLocalSummary";

describe("OfficialDocumentLocalSummaryView", () => {
  it("renders evidence-backed fields and 확인 필요 for missing values", () => {
    const summary = extractOfficialDocumentSummary(`대상: 관내 고등학교 보건교사
제출기한: 2026. 9. 23.(수)까지
참석자 명단을 제출하여 주시기 바랍니다.`);
    const markup = renderToStaticMarkup(
      <OfficialDocumentLocalSummaryView summary={summary} onCopy={vi.fn()} onSendToQuickAdd={vi.fn()} />,
    );

    expect(markup).toContain("기본 핵심정리");
    expect(markup).toContain("내가 해야 할 일");
    expect(markup).toContain("관내 고등학교 보건교사");
    expect(markup).toContain("근거:");
    expect(markup).toContain("확인 필요");
    expect(markup).toContain("전체 복사");
    expect(markup).toContain("BOGUNON 업무로 보내기");
  });
});
