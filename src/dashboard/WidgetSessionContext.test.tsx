import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WidgetSessionProvider, useWidgetSession } from "./WidgetSessionContext";

function MemoProbe() {
  const { memo } = useWidgetSession();
  return <span data-memo={memo}>{memo}</span>;
}

describe("WidgetSessionProvider memo", () => {
  it("starts each provider session with an empty memo", () => {
    const renderSession = () => renderToStaticMarkup(
      <WidgetSessionProvider><MemoProbe /></WidgetSessionProvider>,
    );

    expect(renderSession()).toContain('data-memo=""');
    expect(renderSession()).toContain('data-memo=""');
  });
});
