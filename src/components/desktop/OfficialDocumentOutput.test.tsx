import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { extractOfficialDocumentSummary } from "../../official-document/summaryExtractor";
import { OfficialDocumentOutput } from "./OfficialDocumentOutput";

describe("OfficialDocumentOutput", () => {
  it("keeps local summary, prompt, and AI result as separate ordered sections", () => {
    const markup = renderToStaticMarkup(
      <OfficialDocumentOutput
        aiResponse="연결한 AI 결과"
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
});
