import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecordHelperAiConfirmation } from "./RecordHelperAiConfirmation";

describe("RecordHelperAiConfirmation", () => {
  it("shows the selected model, full prompt, warnings, and explicit actions without sending", () => {
    const markup = renderToStaticMarkup(
      <RecordHelperAiConfirmation
        confirmation={{ reportText: "첫째 줄\n둘째 줄", teacherMemo: "교사 관찰", redactionCount: 2, providerLabel: "ChatGPT 요금제 · GPT Account Model" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain("AI 전송 내용 확인");
    expect(markup).toContain("ChatGPT 요금제 · GPT Account Model");
    expect(markup).toContain("실제 전송될 전체 내용");
    expect(markup).toContain("자동 탐지는 보조 기능");
    expect(markup).toContain("자동 제거된 정보 2건");
    expect(markup).toContain("취소");
    expect(markup).toContain("확인 후 전송");
  });
});
