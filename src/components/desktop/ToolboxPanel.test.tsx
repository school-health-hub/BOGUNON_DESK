import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolboxPanel } from "./ToolboxPanel";

describe("ToolboxPanel", () => {
  it("locks only external tools while launcher settings are loading", () => {
    const markup = renderToStaticMarkup(
      <ToolboxPanel isLoading onClose={() => undefined} onExecute={() => undefined} />,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup.match(/ disabled=""/g)).toHaveLength(2);
    expect(markup).toContain("일반 도구");
    expect(markup).toContain("계산기");
    expect(markup).toContain("생기부 도우미");
    expect(markup).toContain("학생 활동보고서를 불러와 학생별 기록 자료를 정리합니다.");
  });

  it("enables registered tools after launcher settings load", () => {
    const markup = renderToStaticMarkup(
      <ToolboxPanel isLoading={false} onClose={() => undefined} onExecute={() => undefined} />,
    );

    expect(markup).toContain('aria-busy="false"');
    expect(markup).not.toContain(' disabled=""');
  });

  it("shows the link-first Finder with the approved product name", () => {
    const markup = renderToStaticMarkup(
      <ToolboxPanel
        isLoading={false}
        onClose={() => undefined}
        onExecute={() => undefined}
        onOpenEducationVideo={() => undefined}
      />,
    );

    expect(markup).toContain("교육영상 Finder");
    expect(markup).toContain("YouTube 링크 확인·저장과 공문 초안 연결");
    expect(markup).not.toContain("AI 교육영상 Finder · Mock");
  });
});
