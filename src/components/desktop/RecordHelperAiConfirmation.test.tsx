import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecordHelperAiConfirmation } from "./RecordHelperAiConfirmation";

describe("RecordHelperAiConfirmation", () => {
  it("shows the selected model, full prompt, warnings, and explicit actions without sending", () => {
    const markup = renderToStaticMarkup(
      <RecordHelperAiConfirmation
        confirmation={{ reportText: "첫째 줄\n둘째 줄", teacherMemo: "교사 관찰", redactionCount: 2, identityHints: [], providerLabel: "ChatGPT 요금제 · GPT Account Model" }}
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

  it("shows a distinct identity warning and disables confirmation until identity content is removed", () => {
    const withIdentity = renderToStaticMarkup(
      <RecordHelperAiConfirmation
        confirmation={{ reportText: "자료 조사 결과 010-1234-5678", teacherMemo: "", redactionCount: 1, identityHints: [], providerLabel: "ChatGPT 요금제 · GPT Account Model" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const afterRemoval = renderToStaticMarkup(
      <RecordHelperAiConfirmation
        confirmation={{ reportText: "자료 조사 결과", teacherMemo: "", redactionCount: 1, identityHints: [], providerLabel: "ChatGPT 요금제 · GPT Account Model" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(withIdentity).toContain("학생 식별정보가 남아 있습니다. 전송용 편집본에서 삭제해 주세요.");
    expect(withIdentity).toMatch(/<button[^>]*disabled=""[^>]*>확인 후 전송<\/button>/);
    expect(afterRemoval).not.toContain("학생 식별정보가 남아 있습니다.");
    expect(afterRemoval).not.toMatch(/<button[^>]*disabled=""[^>]*>확인 후 전송<\/button>/);
  });

  it("blocks a locally held exact identity hint without rendering the hint as metadata", () => {
    const markup = renderToStaticMarkup(
      <RecordHelperAiConfirmation
        confirmation={{ reportText: "홍길동은 발표함", teacherMemo: "", redactionCount: 1, identityHints: ["홍길동"], providerLabel: "ChatGPT 요금제 · GPT Account Model" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain("학생 식별정보가 남아 있습니다.");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>확인 후 전송<\/button>/);
  });
});
