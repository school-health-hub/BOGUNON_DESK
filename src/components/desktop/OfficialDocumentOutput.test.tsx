import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { extractOfficialDocumentSummary } from "../../official-document/summaryExtractor";
import { OfficialDocumentOutput } from "./OfficialDocumentOutput";

describe("OfficialDocumentOutput", () => {
  it("keeps local summary, prompt, and AI result as separate ordered sections", () => {
    const markup = renderToStaticMarkup(
      <OfficialDocumentOutput
        aiResponse="연결한 AI 결과"
        aiStatus="idle"
        draft={null}
        localSummary={extractOfficialDocumentSummary("대상: 관내 학교")}
        mode="summary"
        onCopy={vi.fn()}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt="AI 프롬프트"
      />,
    );

    const localIndex = markup.indexOf("기본 핵심정리");
    const promptIndex = markup.indexOf("AI 프롬프트 미리보기");
    const aiIndex = markup.indexOf("연결한 AI 작성 결과");
    expect(localIndex).toBeGreaterThan(-1);
    expect(promptIndex).toBeGreaterThan(localIndex);
    expect(aiIndex).toBeGreaterThan(promptIndex);
  });

  it.each([
    ["generating" as const, "이전 AI 결과", "새 결과를 작성하는 동안 이전 정상 결과를 표시합니다."],
    ["error" as const, "이전 AI 결과 유지됨", null],
  ])("labels a preserved result while AI status is %s", (aiStatus, heading, notice) => {
    const markup = renderToStaticMarkup(
      <OfficialDocumentOutput
        aiResponse="보존된 정상 결과"
        aiStatus={aiStatus}
        draft={null}
        localSummary={null}
        mode="revision"
        onCopy={vi.fn()}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt="검토된 전송본"
      />,
    );
    expect(markup).toContain(heading);
    expect(markup).toContain("보존된 정상 결과");
    if (notice !== null) expect(markup).toContain(notice);
  });
});
