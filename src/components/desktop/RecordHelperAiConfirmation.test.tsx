import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecordHelperAiConfirmation } from "./RecordHelperAiConfirmation";

describe("RecordHelperAiConfirmation", () => {
  it("shows the selected model, full prompt, warnings, and explicit actions without sending", () => {
    const prompt = "첫째 줄\n둘째 줄\n전체 전송 프롬프트";
    const markup = renderToStaticMarkup(
      <RecordHelperAiConfirmation
        confirmation={{ prompt, providerLabel: "ChatGPT 요금제 · GPT Account Model" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain("AI 전송 내용 확인");
    expect(markup).toContain("ChatGPT 요금제 · GPT Account Model");
    expect(markup).toContain("전체 전송 프롬프트");
    expect(markup).toContain("자동 개인정보 검사는 보조 기능");
    expect(markup).toContain("취소");
    expect(markup).toContain("확인 후 전송");
  });
});
