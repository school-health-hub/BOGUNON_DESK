import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalculatorPanel } from "./CalculatorPanel";

describe("CalculatorPanel", () => {
  it("renders the compact calculator tabs, result control, and accessible keypad", () => {
    const markup = renderToStaticMarkup(
      <CalculatorPanel initialDate="2026-09-22" onClose={() => undefined} onNotice={() => undefined} />,
    );

    expect(markup).toContain('aria-label="업무 계산기"');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("일반");
    expect(markup).toContain("퍼센트");
    expect(markup).toContain("날짜");
    expect(markup).toContain("단위");
    expect(markup).toContain('aria-label="한 자리 지우기"');
    expect(markup).toContain("결과 복사");
  });
});
