import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommandPalette } from "./CommandPalette";

describe("CommandPalette", () => {
  const props = {
    authStatus: "signedOut" as const,
    favorites: [],
    onClose: () => undefined,
    onCommand: () => Promise.resolve(),
    onFolder: () => Promise.resolve(),
    onSearchResult: () => Promise.resolve(),
    onRequestOpen: () => undefined,
    userId: null,
  };
  it("renders compact grouped command rows when open", () => {
    const markup = renderToStaticMarkup(
      <CommandPalette {...props} isOpen />,
    );
    expect(markup).toContain("명령 검색");
    expect(markup).toContain("빠른 실행");
    expect(markup).toContain("연결");
    expect(markup).toContain("화면");
    expect(markup).toContain("빠른 추가");
  });

  it("does not render a dialog while closed", () => {
    const markup = renderToStaticMarkup(
      <CommandPalette {...props} isOpen={false} />,
    );
    expect(markup).toBe("");
  });

});
