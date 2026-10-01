import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WidgetSessionProvider } from "../../dashboard/WidgetSessionContext";
import { DesktopPanelProvider } from "./DesktopPanelContext";
import { QuickMemoPanel } from "./QuickMemoPanel";

describe("QuickMemoPanel", () => {
  it("renders session-only guidance and shared editor", () => {
    const markup = renderToStaticMarkup(createElement(WidgetSessionProvider, {
      children: createElement(DesktopPanelProvider, {
        notify: () => undefined,
        openBogunonTask: async () => undefined,
        openInbox: () => undefined,
        openQuickAddEventForDate: () => undefined,
        openQuickAddFromMemo: () => undefined,
        openQuickMemoUrl: async () => undefined,
    runDesktopAction: async () => undefined,
    workFolderFavorites: [],
    openWorkFolderFavorite: async () => undefined,
        children: createElement(QuickMemoPanel, { onClose: () => undefined }),
      }),
    }));
    expect(markup).toContain("지금 필요한 내용을 잠깐 적어 둡니다.");
    expect(markup).toContain("앱을 종료하면 메모가 사라집니다.");
    expect(markup).toContain("업무로 보내기");
  });
});
