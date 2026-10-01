import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QuickAddPanel } from "./QuickAddPanel";

const renderPanel = (initialKind: "task" | "event" = "task", authStatus: "signedIn" | "signedOut" | "loading" = "signedIn", initialTaskTitle?: string) => renderToStaticMarkup(
  <QuickAddPanel
    authStatus={authStatus}
    error={null}
    initialDate="2026-09-22"
    initialKind={initialKind}
    initialTaskTitle={initialTaskTitle}
    isSaving={false}
    onClose={() => undefined}
    onSubmit={() => Promise.resolve()}
  />,
);

describe("QuickAddPanel", () => {
  it("renders the task form with task defaults", () => {
    const markup = renderPanel();
    expect(markup).toContain("빠른 추가");
    expect(markup).toContain('value="healthWork"');
    expect(markup).toContain('value="other"');
    expect(markup).toContain('value="normal"');
    expect(markup).toContain('value="2026-09-22"');
    expect(markup).toContain("마감일 (선택)");
    expect(markup.match(/type="date"/g)).toHaveLength(2);
    expect(markup.indexOf("수행일")).toBeLessThan(markup.indexOf("마감일 (선택)"));
    expect(markup.indexOf("마감일 (선택)")).toBeLessThan(markup.indexOf("영역"));
  });

  it("renders the event form with school schedule as the default", () => {
    const markup = renderPanel("event");
    expect(markup).toContain("일정 제목");
    expect(markup).toContain('value="2026-09-22"');
    expect(markup).toContain('value="schoolSchedule"');
    expect(markup).toContain('value=""');
    expect(markup).not.toContain("업무 카테고리");
    expect(markup).not.toContain("마감일 (선택)");
    expect(markup.match(/type="date"/g)).toHaveLength(1);
  });

  it("blocks saving and shows account guidance while signed out", () => {
    const markup = renderPanel("task", "signedOut");
    expect(markup).toContain("Google 계정을 연결해 주세요");
    expect(markup).toContain('disabled=""');
  });

  it("disables saving while auth is loading", () => {
    const markup = renderPanel("task", "loading");
    expect(markup).toContain('disabled=""');
  });

  it("prefills only the task title supplied by Quick Memo", () => {
    const markup = renderPanel("task", "signedIn", "결핵검진 결과 공문 확인");

    expect(markup).toContain('value="결핵검진 결과 공문 확인"');
    expect(markup).not.toContain("두 번째 줄");
  });

  it("prefills the optional official-document task values without saving", () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const markup = renderToStaticMarkup(
      <QuickAddPanel
        authStatus="signedIn"
        error={null}
        initialDate="2026-09-25"
        initialKind="task"
        initialTaskTitle="참석자 명단 제출"
        initialTaskArea="healthWork"
        initialTaskCategory="officialDocument"
        initialTaskPriority="normal"
        initialTaskDueDate="2026-09-30"
        isSaving={false}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    expect(markup).toContain('value="참석자 명단 제출"');
    expect(markup).toContain('value="2026-09-25"');
    expect(markup).toContain('value="2026-09-30"');
    expect(markup).toContain('<option value="healthWork" selected="">보건업무</option>');
    expect(markup).toContain('<option value="officialDocument" selected="">공문</option>');
    expect(markup).toContain('<option value="normal" selected="">보통</option>');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
