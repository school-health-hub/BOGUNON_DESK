import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecordHelperDiscardConfirmation } from "./RecordHelperDiscardConfirmation";
import discardConfirmationSource from "./RecordHelperDiscardConfirmation.tsx?raw";

describe("RecordHelperDiscardConfirmation", () => {
  it("explains session-only data loss and provides cancel and confirm actions", () => {
    const markup = renderToStaticMarkup(
      <RecordHelperDiscardConfirmation
        request={{ kind: "close" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("생기부 도우미를 닫으면 원문, 입력한 메모와 AI 초안이 모두 사라집니다. 닫을까요?");
    expect(markup).toContain("취소");
    expect(markup).toContain("닫고 비우기");
  });

  it("uses explicit copy for clearing all reports and removing edited reports", () => {
    const clearMarkup = renderToStaticMarkup(
      <RecordHelperDiscardConfirmation request={{ kind: "clear" }} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    const removeMarkup = renderToStaticMarkup(
      <RecordHelperDiscardConfirmation
        request={{ kind: "remove", reportId: "report-a", sourceName: "합성-보고서.pdf" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(clearMarkup).toContain("가져온 원문, 입력한 메모와 AI 초안이 모두 사라집니다. 전체 비울까요?");
    expect(clearMarkup).toContain("전체 비우기");
    expect(removeMarkup).toContain("합성-보고서.pdf");
    expect(removeMarkup).toContain("분류 정보, 교사 메모와 AI 초안이 모두 사라집니다. 제거할까요?");
  });

  it("keeps Escape cancellation from reaching the parent panel close listener", () => {
    expect(discardConfirmationSource).toContain("event.nativeEvent.stopImmediatePropagation()");
  });
});
