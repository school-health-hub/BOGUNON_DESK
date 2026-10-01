import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuickMemoEditor } from "./QuickMemoEditor";

const renderEditor = (memo: string): string => renderToStaticMarkup(createElement(QuickMemoEditor, {
  id: "memo-test",
  memo,
  mode: "panel",
  onChange: () => undefined,
  onCreateTask: () => undefined,
  onNotice: () => undefined,
  onOpenUrl: async () => undefined,
}));

describe("QuickMemoEditor", () => {
  it("renders empty session controls disabled", () => {
    const markup = renderEditor("");
    expect(markup).toContain("잊기 전에 메모해 두세요.");
    expect(markup).toContain("disabled");
  });

  it("renders safe detected links and task handoff action", () => {
    const markup = renderEditor("공문 확인\nhttps://example.com/path");
    expect(markup).toContain("링크 1개");
    expect(markup).toContain("example.com/path");
    expect(markup).toContain("업무로 보내기");
    expect(markup).toContain('aria-label="메모 30자"');
  });
});
