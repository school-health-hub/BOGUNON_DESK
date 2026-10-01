import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolboxPanel } from "./ToolboxPanel";

describe("ToolboxPanel", () => {
  it("locks every tool while launcher settings are loading", () => {
    const markup = renderToStaticMarkup(
      <ToolboxPanel isLoading onClose={() => undefined} onExecute={() => undefined} />,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup.match(/ disabled=""/g)).toHaveLength(3);
    expect(markup).toContain("일반 도구");
    expect(markup).toContain("계산기");
  });

  it("enables registered tools after launcher settings load", () => {
    const markup = renderToStaticMarkup(
      <ToolboxPanel isLoading={false} onClose={() => undefined} onExecute={() => undefined} />,
    );

    expect(markup).toContain('aria-busy="false"');
    expect(markup).not.toContain(' disabled=""');
  });
});
